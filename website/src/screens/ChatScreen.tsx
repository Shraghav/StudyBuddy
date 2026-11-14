import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
  Button,
  Avatar,
  useTheme
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatApi, documentApi } from '../services/api';
import { ChatSessionItem, ChatMessage, DocumentItem, CitationItem } from '../types';
import { InlineCitations } from '../components/InlineCitations';
import { PdfViewerModal } from '../components/PdfViewerModal';

// Module-level document cache to eliminate asynchronous latency and flicker
let cachedDocuments: DocumentItem[] = [];

// Pre-populate document cache eagerly
documentApi.getAll().then((docs) => {
  cachedDocuments = docs;
}).catch(() => {});

interface ChatScreenProps {
  currentSession: ChatSessionItem | null;
  readyDocs?: DocumentItem[];
  onSessionUpdated: () => void;
  onOpenNewChatModal: () => void;
  userEmail?: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentSession,
  readyDocs = [],
  onSessionUpdated,
  onOpenNewChatModal,
  userEmail
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Attached document preview modal state & immediate synchronous resolution
  const [previewOpen, setPreviewOpen] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState<DocumentItem | null>(() => {
    const sid = currentSession?.id;
    const storedDocId = sid ? localStorage.getItem(`sb_session_doc_${sid}`) : null;
    const storedDocName = sid ? localStorage.getItem(`sb_session_doc_name_${sid}`) : null;
    const docId = currentSession?.document_id || storedDocId;
    const docName =
      currentSession?.attachedDocName && currentSession.attachedDocName !== 'No document attached'
        ? currentSession.attachedDocName
        : storedDocName;

    const allDocs = readyDocs && readyDocs.length > 0 ? readyDocs : cachedDocuments;
    if (allDocs.length > 0 && (docId || docName)) {
      const match = allDocs.find(
        (d) => (docId && d.id === docId) || (docName && d.name === docName)
      );
      if (match) return match;
    }
    if (docName && docName !== 'No document attached') {
      return {
        id: docId || '',
        name: docName,
        upload_date: null,
        status: 'READY',
        file_url: ''
      };
    }
    return null;
  });

  // Helper to derive fallback citations from text if not saved (e.g. [1], [4], [5])
  const deriveCitationsFromText = (text: string): CitationItem[] => {
    if (!text) return [];
    const matches = [...text.matchAll(/(?<!\[)\[(\d+)\](?!\()/g)];
    if (!matches || matches.length === 0) return [];
    const uniqueNums = Array.from(new Set(matches.map((m) => parseInt(m[1], 10)))).sort((a, b) => a - b);
    return uniqueNums.map((num) => ({
      id: num,
      page: num,
      snippet: `Document passage corresponding to cited Source [${num}].`
    }));
  };

  // Load messages and attached document when currentSession changes
  useEffect(() => {
    if (currentSession && currentSession.messages && currentSession.messages.length > 0) {
      const storageKey = `sb_citations_${currentSession.id}`;
      let cachedMap: Record<string, CitationItem[]> = {};
      try {
        cachedMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
      } catch {
        cachedMap = {};
      }

      const hydrated = currentSession.messages.map((msg) => {
        if (msg.sender === 'ai') {
          const citations =
            msg.citations && msg.citations.length > 0
              ? msg.citations
              : cachedMap[msg.id] || deriveCitationsFromText(msg.text);
          return { ...msg, citations };
        }
        return msg;
      });
      setMessages(hydrated);
    } else if (!currentSession) {
      setMessages([]);
    }
    setStreamError(null);

    // Look up document info if session has attached document (matching by id or name)
    const sid = currentSession?.id;
    const storedDocId = sid ? localStorage.getItem(`sb_session_doc_${sid}`) : null;
    const storedDocName = sid ? localStorage.getItem(`sb_session_doc_name_${sid}`) : null;
    const docId = currentSession?.document_id || storedDocId;
    const docName =
      currentSession?.attachedDocName && currentSession.attachedDocName !== 'No document attached'
        ? currentSession.attachedDocName
        : storedDocName;

    const allDocs = readyDocs && readyDocs.length > 0 ? readyDocs : cachedDocuments;

    // 1. Immediately match against available docs in memory (0ms synchronous)
    if (allDocs.length > 0 && (docId || docName)) {
      const match = allDocs.find(
        (d) => (docId && d.id === docId) || (docName && docName !== 'No document attached' && d.name === docName)
      );
      if (match) {
        setAttachedDoc(match);
        setDocLoading(false);
        if (sid) {
          try {
            localStorage.setItem(`sb_session_doc_${sid}`, match.id);
            localStorage.setItem(`sb_session_doc_name_${sid}`, match.name);
          } catch {}
        }
        return;
      }
    }

    // 2. Immediate placeholder if name is known from current session or storage
    if (docName && docName !== 'No document attached') {
      setAttachedDoc((prev) =>
        prev?.id === docId && prev?.file_url
          ? prev
          : {
              id: docId || '',
              name: docName,
              upload_date: null,
              status: 'READY',
              file_url: ''
            }
      );
    }

    // 3. If docId or docName exists, query documentApi with automatic retry if being attached
    if (docId || (docName && docName !== 'No document attached')) {
      setDocLoading(true);
      let isMounted = true;

      const resolveDoc = async (retryCount = 2) => {
        try {
          const docs = await documentApi.getAll();
          if (!isMounted) return;
          cachedDocuments = docs;
          const found = docs.find(
            (d) => (docId && d.id === docId) || (docName && docName !== 'No document attached' && d.name === docName)
          );

          if (found) {
            setAttachedDoc(found);
            setDocLoading(false);
            if (sid) {
              try {
                localStorage.setItem(`sb_session_doc_${sid}`, found.id);
                localStorage.setItem(`sb_session_doc_name_${sid}`, found.name);
              } catch {}
            }
          } else if (retryCount > 0) {
            setTimeout(() => {
              if (isMounted) resolveDoc(retryCount - 1);
            }, 800);
          } else {
            setDocLoading(false);
          }
        } catch (err) {
          if (isMounted) setDocLoading(false);
          console.error('Error fetching documents in ChatScreen:', err);
        }
      };

      resolveDoc();

      return () => {
        isMounted = false;
      };
    } else {
      setAttachedDoc(null);
      setDocLoading(false);
    }
  }, [currentSession?.id, currentSession?.document_id, currentSession?.attachedDocName, readyDocs]);

  const handleOpenDocPreview = async () => {
    if (attachedDoc?.file_url) {
      setPreviewOpen(true);
      return;
    }
    setPreviewOpen(true);
    try {
      const docs = cachedDocuments.length > 0 ? cachedDocuments : await documentApi.getAll();
      cachedDocuments = docs;
      const docId = currentSession?.document_id || attachedDoc?.id;
      const docName = attachedDoc?.name || currentSession?.attachedDocName;
      const found = docs.find((d) => (docId && d.id === docId) || (docName && d.name === docName));
      if (found && found.file_url) {
        setAttachedDoc(found);
      }
    } catch (e) {
      console.error('Error loading document preview URL:', e);
    }
  };

  // Helper to highlight citation markers like [1], [4], [5], [1][4][5] into markdown links
  const formatTextWithCitations = (text: string) => {
    if (!text) return '';
    return text.replace(/(?<!\[)\[(\d+)\](?!\()/g, '[[$1]](#citation-$1)');
  };

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isStreaming) return;

    if (!currentSession) {
      onOpenNewChatModal();
      return;
    }

    const question = inputText.trim();
    setInputText('');
    setStreamError(null);

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      text: question,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      text: '',
      sender: 'ai',
      timestamp: new Date().toISOString(),
      citations: []
    };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    setIsStreaming(true);

    let accumulatedText = '';
    let accumulatedCitations: CitationItem[] = [];

    await chatApi.streamMessage(
      currentSession.id,
      question,
      (token) => {
        accumulatedText += token;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, text: accumulatedText } : msg
          )
        );
      },
      (citations) => {
        accumulatedCitations = [...accumulatedCitations, ...citations];
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, citations: accumulatedCitations } : msg
          )
        );
        if (currentSession?.id) {
          try {
            const storageKey = `sb_citations_${currentSession.id}`;
            const existingMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
            existingMap[aiMsgId] = accumulatedCitations;
            localStorage.setItem(storageKey, JSON.stringify(existingMap));
          } catch { }
        }
      },
      () => {
        setIsStreaming(false);
        if (currentSession?.id && accumulatedCitations.length > 0) {
          try {
            const storageKey = `sb_citations_${currentSession.id}`;
            const existingMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
            existingMap[aiMsgId] = accumulatedCitations;
            localStorage.setItem(storageKey, JSON.stringify(existingMap));
          } catch { }
        }
        onSessionUpdated();
      },
      (err) => {
        setIsStreaming(false);
        setStreamError(err.message || 'Error occurred while streaming response.');
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: theme.palette.background.default }}>
      {/* Chat Header */}
      <Box
        sx={{
          py: 1.5,
          px: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: theme.palette.text.primary }}>
            {currentSession?.title || 'Study Assistant Chat'}
          </Typography>

          {/* Attached Document Pill - Click opens centered PDF modal */}
          {attachedDoc && attachedDoc.name && attachedDoc.name !== 'No document attached' ? (
            <Tooltip title="Click to view attached document">
              <Chip
                icon={<DescriptionOutlinedIcon fontSize="small" />}
                label={attachedDoc.name}
                color="primary"
                variant="outlined"
                onClick={handleOpenDocPreview}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                }}
              />
            </Tooltip>
          ) : (currentSession?.attachedDocName && currentSession.attachedDocName !== 'No document attached') || (currentSession?.id && localStorage.getItem(`sb_session_doc_name_${currentSession.id}`)) ? (
            <Tooltip title="Click to view attached document">
              <Chip
                icon={<DescriptionOutlinedIcon fontSize="small" />}
                label={
                  (currentSession?.attachedDocName && currentSession.attachedDocName !== 'No document attached')
                    ? currentSession.attachedDocName
                    : (currentSession?.id ? localStorage.getItem(`sb_session_doc_name_${currentSession.id}`) || '' : '')
                }
                color="primary"
                variant="outlined"
                onClick={handleOpenDocPreview}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                }}
              />
            </Tooltip>
          ) : docLoading || currentSession?.document_id || (currentSession?.id && localStorage.getItem(`sb_session_doc_${currentSession.id}`)) ? (
            <Chip
              icon={<CircularProgress size={12} color="inherit" />}
              label="Loading document..."
              size="small"
              variant="outlined"
              sx={{ color: theme.palette.text.secondary }}
            />
          ) : (
            <Chip
              label="No document attached"
              size="small"
              variant="outlined"
              sx={{ color: theme.palette.text.secondary }}
            />
          )}
        </Box>
      </Box>

      {/* Stream Error Alert */}
      {streamError && (
        <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setStreamError(null)}>
          {streamError}
        </Alert>
      )}

      {/* Message Feed Canvas */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {!currentSession ? (
          <Box sx={{ my: 'auto', textAlign: 'center', maxWidth: 500, mx: 'auto' }}>
            <AutoAwesomeIcon sx={{ fontSize: 56, color: theme.palette.primary.main, mb: 2 }} />
            <Typography variant="h5" fontWeight={800} gutterBottom>
              Welcome to StudyBuddy Chat
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select a conversation from Chat History on the left, or create a new session linked to your study notes.
            </Typography>
            <Button variant="contained" color="primary" onClick={onOpenNewChatModal} sx={{ px: 3, py: 1.2, fontWeight: 700 }}>
              Start New Chat
            </Button>
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ my: 'auto', textAlign: 'center', maxWidth: 450, mx: 'auto' }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Ready to study {attachedDoc?.name || 'your notes'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask questions, request summaries, or clarify tough concepts. AI answers are grounded in your document with source citations.
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 1.5
                }}
              >
                {!isUser && (
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                      color: theme.palette.primary.main,
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.25)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.5
                    }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                )}

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    px: 2.5,
                    maxWidth: '75%',
                    borderRadius: 3,
                    bgcolor: isUser
                      ? theme.palette.primary.main
                      : theme.palette.mode === 'dark'
                        ? '#1e293b'
                        : '#ffffff',
                    color: isUser ? '#ffffff' : theme.palette.text.primary,
                    border: `1px solid ${isUser ? 'transparent' : theme.palette.divider}`
                  }}
                >
                  {isUser ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {msg.text}
                    </Typography>
                  ) : (
                    <>
                      {msg.text === '' && isStreaming ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Thinking
                              </Typography>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.6,
                                  '@keyframes sbDotPulse': {
                                    '0%, 80%, 100%': { transform: 'scale(0.35)', opacity: 0.25 },
                                    '40%': { transform: 'scale(1)', opacity: 1 }
                                  }
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 5.5,
                                    height: 5.5,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.primary.main,
                                    animation: 'sbDotPulse 1.4s infinite ease-in-out both',
                                    animationDelay: '0s'
                                  }}
                                />
                                <Box
                                  sx={{
                                    width: 5.5,
                                    height: 5.5,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.primary.main,
                                    animation: 'sbDotPulse 1.4s infinite ease-in-out both',
                                    animationDelay: '0.2s'
                                  }}
                                />
                                <Box
                                  sx={{
                                    width: 5.5,
                                    height: 5.5,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.primary.main,
                                    animation: 'sbDotPulse 1.4s infinite ease-in-out both',
                                    animationDelay: '0.4s'
                                  }}
                                />
                              </Box>
                            </Box>
                            ) : (
                            <Box sx={{ '& p': { m: 0, mb: 1, lineHeight: 1.6 }, '& pre': { p: 1.5, borderRadius: 2, overflowX: 'auto', bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9' } }}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  a: ({ href, children, ...props }) => {
                                    if (href?.startsWith('#citation-')) {
                                      const citeNum = parseInt(href.replace('#citation-', ''), 10);
                                      const matchedCitation = msg.citations?.find((c) => c.id === citeNum);
                                      return (
                                        <Tooltip
                                          key={href}
                                          arrow
                                          title={
                                            matchedCitation
                                              ? `Source ${citeNum} (Page ${matchedCitation.page}): ${matchedCitation.snippet.slice(0, 80)}...`
                                              : `Citation Source [${citeNum}]`
                                          }
                                        >
                                          <Box
                                            component="span"
                                            sx={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              mx: 0.25,
                                              px: 0.65,
                                              py: 0.1,
                                              borderRadius: '8px',
                                              bgcolor:
                                                theme.palette.mode === 'dark'
                                                  ? 'rgba(99, 102, 241, 0.28)'
                                                  : 'rgba(99, 102, 241, 0.14)',
                                              color:
                                                theme.palette.mode === 'dark'
                                                  ? '#a5b4fc'
                                                  : '#4f46e5',
                                              border: '1px solid',
                                              borderColor:
                                                theme.palette.mode === 'dark'
                                                  ? 'rgba(99, 102, 241, 0.45)'
                                                  : 'rgba(99, 102, 241, 0.35)',
                                              fontSize: '0.75rem',
                                              fontWeight: 800,
                                              fontFamily: 'monospace',
                                              lineHeight: 1.4,
                                              verticalAlign: 'baseline',
                                              cursor: 'pointer',
                                              userSelect: 'none',
                                              transition: 'all 0.15s ease',
                                              '&:hover': {
                                                bgcolor:
                                                  theme.palette.mode === 'dark'
                                                    ? 'rgba(99, 102, 241, 0.5)'
                                                    : 'rgba(99, 102, 241, 0.25)',
                                                borderColor: theme.palette.primary.main,
                                                transform: 'translateY(-1px)'
                                              }
                                            }}
                                          >
                                            {children}
                                          </Box>
                                        </Tooltip>
                                      );
                                    }
                                    return (
                                      <a href={href} target="_blank" rel="noreferrer" {...props}>
                                        {children}
                                      </a>
                                    );
                                  }
                                }}
                              >
                                {formatTextWithCitations(msg.text)}
                              </ReactMarkdown>
                            </Box>
                      )}

                            {/* Inline Citations placed directly at the bottom of the AI message */}
                            {msg.citations && msg.citations.length > 0 && (
                              <InlineCitations citations={msg.citations} />
                            )}
                          </>
                  )}
                        </Paper>

                {isUser && (
                          <Avatar
                    sx={{
                            width: 36,
                            height: 36,
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            bgcolor: theme.palette.secondary.main,
                            color: '#fff',
                            flexShrink: 0,
                            mt: 0.5
                          }}
                        >
                    {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
                    </Avatar>
                )}
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Chat Input Bar */}
      {currentSession && (
        <Box
          component="form"
          onSubmit={handleSendMessage}
          sx={{
            p: 2,
            px: 3,
            bgcolor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask a question about your study material... (Press Enter to send)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            InputProps={{
              endAdornment: (
                <IconButton
                  color="primary"
                  type="submit"
                  disabled={!inputText.trim() || isStreaming}
                  sx={{ p: 1 }}
                >
                  <SendIcon />
                </IconButton>
              ),
              sx: { borderRadius: 3, pr: 1 }
            }}
          />
        </Box>
      )}

      {/* Centered PDF Viewer Modal for attached document */}
      <PdfViewerModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        documentTitle={attachedDoc?.name || ''}
        fileUrl={attachedDoc?.file_url || null}
      />
    </Box>
  );
};

