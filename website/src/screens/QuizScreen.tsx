import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Paper,
  Divider,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { quizApi, documentApi } from '../services/api';
import {
  QuizSessionSummary,
  QuizSessionActive,
  QuizSessionCompleted,
  QuizGenerationParams,
  DocumentItem
} from '../types';
import { PdfViewerModal } from '../components/PdfViewerModal';

interface QuizScreenProps {
  currentQuizSession: QuizSessionSummary | null;
  onQuizUpdated: () => void;
  onOpenNewQuizModal: () => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({
  currentQuizSession,
  onQuizUpdated,
  onOpenNewQuizModal
}) => {
  const theme = useTheme();

  // Polled session data
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Setup Phase Form state
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Active Quiz Phase state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // { [question_id]: "A" | "B" ... }
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  // Attached Document and PDF viewer state
  const [attachedDoc, setAttachedDoc] = useState<DocumentItem | null>(null);
  const [previewPdfOpen, setPreviewPdfOpen] = useState(false);

  // Polling ref to clear interval reliably
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  /**
   * Dedicated status poller that executes until the quiz transitions to 'active', 'completed', or 'error'.
   */
  const startPolling = (sessionId: string) => {
    stopPolling();
    pollingTimerRef.current = setInterval(async () => {
      try {
        const data = await quizApi.pollStatus(sessionId);
        const normStatus = String(data?.status || '').toLowerCase();
        if (data && (normStatus.includes('active') || normStatus.includes('complete'))) {
          stopPolling();
          setSessionDetail(data);
          setGenerating(false);
          setCurrentQIndex(0);

          if (normStatus.includes('active')) {
            const activeData = data as QuizSessionActive;
            const existingAnswers: Record<string, string> = {};
            if (activeData.questions) {
              activeData.questions.forEach((q: any) => {
                if (q.user_answer) existingAnswers[q.id] = q.user_answer;
              });
            }
            setUserAnswers(existingAnswers);
          }
          onQuizUpdated();
        } else if (data && normStatus.includes('error')) {
          stopPolling();
          setGenerating(false);
          setSessionDetail(data);
          onQuizUpdated();
        }
      } catch (err) {
        console.error('Error polling quiz status:', err);
      }
    }, 1500);
  };

  // Load Quiz Session details
  const loadQuizDetails = async (sessionId: string) => {
    try {
      const data = await quizApi.pollStatus(sessionId);
      setSessionDetail(data);

      const normStatus = String(data?.status || '').toLowerCase();
      if (normStatus.includes('active')) {
        const activeData = data as QuizSessionActive;
        const existingAnswers: Record<string, string> = {};
        if (activeData.questions) {
          activeData.questions.forEach((q: any) => {
            if (q.user_answer) existingAnswers[q.id] = q.user_answer;
          });
        }
        setUserAnswers(existingAnswers);
      }

      // If session is still generating, continue polling
      if (normStatus.includes('gen')) {
        setGenerating(true);
        startPolling(sessionId);
      } else {
        setGenerating(false);
      }

      return data;
    } catch (err: any) {
      console.error('Error loading quiz detail:', err);
      return null;
    }
  };

  useEffect(() => {
    stopPolling();

    if (!currentQuizSession) {
      setSessionDetail(null);
      setGenerating(false);
      setAttachedDoc(null);
      return;
    }

    setLoading(true);
    setCurrentQIndex(0);
    setUserAnswers({});

    loadQuizDetails(currentQuizSession.session_id).finally(() => setLoading(false));

    return () => {
      stopPolling();
    };
  }, [currentQuizSession?.session_id]);

  // Resolve attached document for quiz session
  useEffect(() => {
    let isMounted = true;
    const docId = String(sessionDetail?.document_id || (currentQuizSession as any)?.document_id || '').toLowerCase();
    if (docId) {
      documentApi.getAll().then((docs) => {
        if (!isMounted) return;
        const found = docs.find((d) => String(d.id).toLowerCase() === docId);
        if (found) setAttachedDoc(found);
      }).catch((e) => console.error('Error fetching attached quiz document:', e));
    } else {
      documentApi.getAll().then((docs) => {
        if (!isMounted) return;
        const found = docs.find((d) =>
          sessionDetail?.document_id && String(d.id).toLowerCase() === String(sessionDetail.document_id).toLowerCase()
        );
        if (found) setAttachedDoc(found);
      }).catch(() => { });
    }

    return () => {
      isMounted = false;
    };
  }, [currentQuizSession?.session_id, (currentQuizSession as any)?.document_id, sessionDetail?.document_id]);

  const handleOpenPdfPreview = async () => {
    setPreviewPdfOpen(true);
    if (!attachedDoc?.file_url) {
      try {
        const docs = await documentApi.getAll();
        const docId = String(sessionDetail?.document_id || (currentQuizSession as any)?.document_id || '').toLowerCase();
        const docName = String((currentQuizSession as any)?.document_name || '').toLowerCase();
        const found = docs.find((d) =>
          (docId && String(d.id).toLowerCase() === docId) ||
          (docName && d.name.toLowerCase() === docName)
        );
        if (found) {
          setAttachedDoc(found);
        }
      } catch (err) {
        console.error('Error fetching document file URL for preview:', err);
      }
    }
  };

  /**
   * Trigger Quiz Generation:
   * Immediately moves UI to active/generating load state, kicks off backend task, and polls until active.
   */
  const handleTriggerGeneration = async () => {
    if (!currentQuizSession) return;
    setGenerating(true);

    // Immediately shift screen to generating state
    setSessionDetail({
      session_id: currentQuizSession.session_id,
      title: currentQuizSession.title,
      document_id: (currentQuizSession as any)?.document_id,
      status: 'generating'
    });

    try {
      const params: QuizGenerationParams = {
        numQuestions,
        difficulty,
        customPrompt: customPrompt.trim()
      };
      await quizApi.triggerGeneration(currentQuizSession.session_id, params);
      onQuizUpdated();
      startPolling(currentQuizSession.session_id);
    } catch (err: any) {
      console.error('Error triggering generation:', err);
      setGenerating(false);
    }
  };

  // Handle Selecting an Option in Active Quiz
  const handleSelectOption = (questionId: string, optionKey: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  /**
   * Submit Quiz:
   * Shows a full-screen grading loader, posts answers, loads scored results, and shifts to completed view.
   */
  const handleSubmitQuiz = async () => {
    if (!currentQuizSession || !sessionDetail) return;
    setSubmitting(true);
    setConfirmSubmitOpen(false);

    try {
      const activeData = sessionDetail as QuizSessionActive;
      const payload = (activeData.questions || []).map((q) => ({
        question_id: q.id,
        user_answer: userAnswers[q.id] || ''
      }));

      await quizApi.submitAnswers(currentQuizSession.session_id, payload);

      // Fetch freshly scored completed session details
      const completedData = await quizApi.pollStatus(currentQuizSession.session_id);
      setSessionDetail(completedData);
      onQuizUpdated();
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER: NO QUIZ SELECTED ====================
  if (!currentQuizSession) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: theme.palette.background.default }}>
        <Box sx={{ textAlign: 'center', maxWidth: 460 }}>
          <EmojiEventsIcon sx={{ fontSize: 64, color: theme.palette.primary.main, mb: 2 }} />
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Quiz Assessment Arena
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate adaptive, document-grounded MCQs to test your mastery. Select a quiz from history or create a new assessment.
          </Typography>
          <Button variant="contained" color="primary" onClick={onOpenNewQuizModal} sx={{ px: 3, py: 1.2, fontWeight: 700 }}>
            Create New Quiz
          </Button>
        </Box>

        {/* Centered PDF Viewer Modal for attached document */}
        <PdfViewerModal
          open={previewPdfOpen}
          onClose={() => setPreviewPdfOpen(false)}
          documentTitle={attachedDoc?.name || ''}
          fileUrl={attachedDoc?.file_url || null}
        />
      </Box>
    );
  }

  // ==================== RENDER: INITIAL LOAD SPINNER ====================
  if (loading && !generating) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.background.default }}>
        <CircularProgress />
      </Box>
    );
  }

  // ==================== RENDER: SUBMITTING / GRADING LOADER ====================
  if (submitting) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.background.default, p: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            maxWidth: 480,
            borderRadius: 4,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.06)'
          }}
        >
          <CircularProgress size={56} thickness={4} color="success" sx={{ mb: 3 }} />
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Grading Your Assessment...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Evaluating your answers against document and calculating score results.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const statusRaw = String(generating ? 'generating' : (sessionDetail?.status || currentQuizSession?.status || 'setup')).toLowerCase();
  const status = statusRaw.includes('complete')
    ? 'completed'
    : statusRaw.includes('active')
      ? 'active'
      : statusRaw.includes('gen')
        ? 'generating'
        : statusRaw.includes('err')
          ? 'error'
          : 'setup';

  // ==================== PHASE 1: SETUP FORM ====================
  if (status === 'setup') {
    return (
      <Box sx={{ height: '100vh', overflowY: 'auto', p: 4, display: 'flex', justifyContent: 'center', bgcolor: theme.palette.background.default }}>
        <Card sx={{ maxWidth: 640, width: '100%', height: 'fit-content', p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
          <CardContent sx={{ p: '0 !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AutoAwesomeIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  Configure Quiz Parameters
                </Typography>
              </Box>
              {attachedDoc ? (
                <Tooltip title="Click to view attached document">
                  <Chip
                    icon={<DescriptionOutlinedIcon fontSize="small" />}
                    label={attachedDoc.name}
                    color="primary"
                    variant="outlined"
                    onClick={handleOpenPdfPreview}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                    }}
                  />
                </Tooltip>
              ) : (
                <Chip
                  label="Document linked"
                  size="small"
                  variant="outlined"
                  sx={{ color: theme.palette.text.secondary }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Set rules and customize focus areas for "{currentQuizSession.title}".
            </Typography>

            <Divider sx={{ mb: 3 }} />

            {/* Question Count Slider (1 to 20) */}
            <Box sx={{ mb: 3.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Number of Questions
                </Typography>
                <Chip label={`${numQuestions} Questions`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              </Box>
              <Slider
                value={numQuestions}
                min={1}
                max={5}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 15, label: '15' },
                  { value: 20, label: '20' }
                ]}
                onChange={(_, val) => setNumQuestions(val as number)}
              />
            </Box>

            {/* Difficulty Selector */}
            <Box sx={{ mb: 3.5 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Difficulty Level
              </Typography>
              <ToggleButtonGroup
                value={difficulty}
                exclusive
                fullWidth
                onChange={(_, val) => val && setDifficulty(val)}
              >
                <ToggleButton value="Easy" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                  Easy 🟢
                </ToggleButton>
                <ToggleButton value="Medium" sx={{ fontWeight: 600, color: theme.palette.warning.main }}>
                  Medium 🟡
                </ToggleButton>
                <ToggleButton value="Hard" sx={{ fontWeight: 600, color: theme.palette.error.main }}>
                  Hard 🔴
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Custom Prompt Textarea */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Custom Prompt / Focus Topic (Optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="e.g. Focus on BCNF anomalies and multi-valued dependencies..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                inputProps={{ maxLength: 500 }}
                helperText={`${customPrompt.length}/500 characters`}
              />
            </Box>

            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
              disabled={generating}
              onClick={handleTriggerGeneration}
              sx={{ py: 1.4, borderRadius: 2, fontWeight: 700 }}
            >
              {generating ? 'Starting Generation...' : 'Generate Quiz'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ==================== PHASE 2: GENERATING (Active Screen Load State) ====================
  if (status === 'generating') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.background.default, p: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            maxWidth: 480,
            borderRadius: 4,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.06)'
          }}
        >
          <CircularProgress size={56} thickness={4} sx={{ color: theme.palette.primary.main, mb: 3 }} />
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Generating Your Quiz...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Sampling relevant document chunks and curating {numQuestions} adaptive {difficulty} multiple-choice questions with AI.
          </Typography>
        </Paper>
      </Box>
    );
  }

  // ==================== PHASE 3: ACTIVE TEST (Stepped Card + Dot Palette) ====================
  if (status === 'active') {
    const activeData = sessionDetail as QuizSessionActive;
    const questions = activeData?.questions || [];
    const currentQuestion = questions[currentQIndex];
    const totalQuestions = questions.length;

    if (!currentQuestion) {
      return (
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
          <Box>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6" fontWeight={700}>Loading questions...</Typography>
          </Box>
        </Box>
      );
    }

    const currentSelectedOption = userAnswers[currentQuestion.id] || '';
    const answeredCount = Object.keys(userAnswers).length;

    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.default }}>
        {/* Top Header: Quiz Title & Question Dot Palette */}
        <Box
          sx={{
            py: 2,
            px: 4,
            bgcolor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                {activeData.title || currentQuizSession.title}
              </Typography>
              {attachedDoc && (
                <Tooltip title="Click to view attached document">
                  <Chip
                    icon={<DescriptionOutlinedIcon fontSize="small" />}
                    label={attachedDoc.name}
                    color="primary"
                    variant="outlined"
                    size="small"
                    onClick={handleOpenPdfPreview}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                    }}
                  />
                </Tooltip>
              )}
            </Box>
            <Chip
              label={`Answered: ${answeredCount} / ${totalQuestions}`}
              color={answeredCount === totalQuestions ? 'success' : 'primary'}
              sx={{ fontWeight: 700 }}
            />
          </Box>

          {/* Interactive Question Dot Palette */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', py: 0.5 }}>
            {questions.map((q, idx) => {
              const isCurrent = idx === currentQIndex;
              const isAnswered = Boolean(userAnswers[q.id]);

              return (
                <Box
                  key={q.id || idx}
                  onClick={() => setCurrentQIndex(idx)}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    bgcolor: isCurrent
                      ? theme.palette.primary.main
                      : isAnswered
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(52, 211, 153, 0.2)'
                          : 'rgba(16, 185, 129, 0.15)'
                        : theme.palette.mode === 'dark'
                          ? '#1e293b'
                          : '#f1f5f9',
                    color: isCurrent
                      ? '#ffffff'
                      : isAnswered
                        ? theme.palette.success.main
                        : theme.palette.text.secondary,
                    border: isCurrent
                      ? `2px solid ${theme.palette.primary.dark}`
                      : isAnswered
                        ? `1px solid ${theme.palette.success.main}`
                        : `1px solid ${theme.palette.divider}`,
                    '&:hover': {
                      transform: 'scale(1.1)'
                    }
                  }}
                >
                  {idx + 1}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Question Stepped Card (Centered, Single Question at a Time) */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Card
            sx={{
              maxWidth: 720,
              width: '100%',
              p: 3,
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.palette.mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.05)'
            }}
          >
            <CardContent sx={{ p: '0 !important' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main, letterSpacing: 1 }}>
                QUESTION {currentQIndex + 1} OF {totalQuestions}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1, mb: 3.5, color: theme.palette.text.primary, lineHeight: 1.5 }}>
                {currentQuestion.text}
              </Typography>

              {/* MCQ Options with Distinct Selection Highlighting */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
                {Object.entries(currentQuestion.options || {}).map(([key, text]) => {
                  const isSelected = currentSelectedOption === key;

                  return (
                    <Paper
                      key={key}
                      onClick={() => handleSelectOption(currentQuestion.id, key)}
                      elevation={0}
                      sx={{
                        p: 2,
                        px: 2.5,
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        bgcolor: isSelected
                          ? theme.palette.primary.main
                          : theme.palette.mode === 'dark'
                            ? '#1e293b'
                            : '#f8fafc',
                        color: isSelected ? '#ffffff' : theme.palette.text.primary,
                        border: isSelected
                          ? `2px solid ${theme.palette.primary.main}`
                          : `1px solid ${theme.palette.divider}`,
                        '&:hover': {
                          bgcolor: isSelected
                            ? theme.palette.primary.main
                            : theme.palette.mode === 'dark'
                              ? '#273549'
                              : '#f1f5f9'
                        }
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          bgcolor: isSelected ? '#ffffff' : theme.palette.mode === 'dark' ? '#0f172a' : '#e2e8f0',
                          color: isSelected ? theme.palette.primary.main : theme.palette.text.primary,
                          flexShrink: 0
                        }}
                      >
                        {key}
                      </Box>
                      <Typography variant="body1" fontWeight={isSelected ? 600 : 500}>
                        {text}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Stepped Bottom Navigation */}
        <Box
          sx={{
            py: 2,
            px: 4,
            bgcolor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            disabled={currentQIndex === 0}
            onClick={() => setCurrentQIndex((prev) => prev - 1)}
            sx={{ borderRadius: 2 }}
          >
            Previous
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {currentQIndex < totalQuestions - 1 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setCurrentQIndex((prev) => prev + 1)}
                sx={{ borderRadius: 2, px: 3 }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={<SendIcon />}
                onClick={() => setConfirmSubmitOpen(true)}
                sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
              >
                Submit Assessment
              </Button>
            )}
          </Box>
        </Box>

        {/* Confirmation Dialog before Submitting */}
        <Dialog open={confirmSubmitOpen} onClose={() => setConfirmSubmitOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Submit Quiz?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              You have answered {answeredCount} of {totalQuestions} questions. Are you ready to submit for automated scoring?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmSubmitOpen(false)}>Review Answers</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmitQuiz}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Submitting...' : 'Yes, Submit'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Centered PDF Viewer Modal for attached document */}
        <PdfViewerModal
          open={previewPdfOpen}
          onClose={() => setPreviewPdfOpen(false)}
          documentTitle={attachedDoc?.name || ''}
          fileUrl={attachedDoc?.file_url || null}
        />
      </Box>
    );
  }

  // ==================== PHASE 4: COMPLETED RESULTS VIEW ====================
  if (status === 'completed') {
    const completedData = sessionDetail as QuizSessionCompleted;
    const questions = completedData?.questions || [];
    const totalQuestions = questions.length;
    const score = completedData?.score ?? 0;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    return (
      <Box sx={{ height: '100vh', overflowY: 'auto', p: 4, bgcolor: theme.palette.background.default }}>
        <Box sx={{ maxWidth: 840, mx: 'auto' }}>
          {/* Celebratory Score Card */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 4,
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 3
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main, letterSpacing: 1 }}>
                  ASSESSMENT COMPLETED
                </Typography>
                {attachedDoc && (
                  <Tooltip title="Click to view attached document">
                    <Chip
                      icon={<DescriptionOutlinedIcon fontSize="small" />}
                      label={attachedDoc.name}
                      color="primary"
                      variant="outlined"
                      size="small"
                      onClick={handleOpenPdfPreview}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' }
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: theme.palette.text.primary }}>
                {completedData?.title || currentQuizSession.title}
              </Typography>
              {completedData?.feedback && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 500 }}>
                  "{completedData.feedback}"
                </Typography>
              )}
            </Box>

            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: percentage >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `3px solid ${percentage >= 70 ? theme.palette.success.main : theme.palette.error.main}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="h5" fontWeight={800} color={percentage >= 70 ? 'success.main' : 'error.main'}>
                {score}/{totalQuestions}
              </Typography>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {percentage}%
              </Typography>
            </Box>
          </Paper>

          {/* Question-by-Question Review Breakdown */}
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2.5 }}>
            Detailed Answer Review
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {questions.map((q, idx) => {
              const userAns = (q.user_answer || '').trim().toLowerCase();
              const correctAns = (q.correct_answer || '').trim().toLowerCase();
              const isCorrect = userAns === correctAns && Boolean(userAns);

              return (
                <Card
                  key={q.id || idx}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.paper
                  }}
                >
                  <CardContent sx={{ p: '0 !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        QUESTION {idx + 1}
                      </Typography>
                      <Chip
                        icon={isCorrect ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
                        label={isCorrect ? 'Correct' : 'Incorrect'}
                        color={isCorrect ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>

                    <Typography variant="body1" fontWeight={700} sx={{ mb: 2.5 }}>
                      {q.text}
                    </Typography>

                    {/* Review Options */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {Object.entries(q.options || {}).map(([key, optText]) => {
                        const optKey = key.trim().toLowerCase();
                        const isCorrectOption = optKey === correctAns;
                        const isUserChoice = optKey === userAns;

                        let optBg = theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc';
                        let optBorder = theme.palette.divider;
                        let optColor = theme.palette.text.primary;

                        if (isCorrectOption) {
                          optBg = 'rgba(16, 185, 129, 0.15)';
                          optBorder = theme.palette.success.main;
                          optColor = theme.palette.success.main;
                        } else if (isUserChoice && !isCorrect) {
                          optBg = 'rgba(239, 68, 68, 0.15)';
                          optBorder = theme.palette.error.main;
                          optColor = theme.palette.error.main;
                        }

                        return (
                          <Paper
                            key={key}
                            elevation={0}
                            sx={{
                              p: 1.5,
                              px: 2,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              bgcolor: optBg,
                              border: `1px solid ${optBorder}`,
                              color: optColor
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography fontWeight={800} sx={{ width: 20 }}>
                                {key}.
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {optText}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {isCorrectOption && (
                                <Chip label="Correct Answer" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                              )}
                              {isUserChoice && (
                                <Chip
                                  label="Your Answer"
                                  size="small"
                                  color={isCorrect ? 'success' : 'error'}
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          </Paper>
                        );
                      })}
                    </Box>

                    {/* AI Explanation / Feedback */}
                    {q.evaluation_feedback && (
                      <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9' }}>
                        <Typography variant="caption" fontWeight={700} color="primary">
                          Explanation:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {q.evaluation_feedback}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Box>

        {/* Centered PDF Viewer Modal for attached document */}
        <PdfViewerModal
          open={previewPdfOpen}
          onClose={() => setPreviewPdfOpen(false)}
          documentTitle={attachedDoc?.name || ''}
          fileUrl={attachedDoc?.file_url || null}
        />
      </Box>
    );
  }

  // ==================== PHASE: ERROR / UNEXPECTED ====================
  if (status === 'error') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: theme.palette.background.default }}>
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', maxWidth: 440, borderRadius: 4, border: `1px solid ${theme.palette.divider}` }}>
          <CancelIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={800} gutterBottom>
            Generation Encountered an Issue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The AI could not generate questions for this document. Please check your document or try again.
          </Typography>
          <Button variant="contained" onClick={() => setSessionDetail({ ...(sessionDetail || {}), status: 'setup' })}>
            Back to Setup
          </Button>
        </Paper>
      </Box>
    );
  }

  // Fallback: If status is unknown, render Setup card or a friendly state so white screen is impossible
  return (
    <Box sx={{ height: '100vh', overflowY: 'auto', p: 4, display: 'flex', justifyContent: 'center', bgcolor: theme.palette.background.default }}>
      <Card sx={{ maxWidth: 640, width: '100%', height: 'fit-content', p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
        <CardContent sx={{ p: '0 !important', textAlign: 'center' }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1.5 }} />
          <Typography variant="h6" fontWeight={800} gutterBottom>
            {currentQuizSession?.title || 'Quiz Assessment'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Current Status: {currentQuizSession?.status || 'Ready for Setup'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setSessionDetail({ ...(sessionDetail || {}), status: 'setup' });
            }}
          >
            Configure & Start Quiz
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};
