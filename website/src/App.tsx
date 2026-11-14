import React, { useState, useEffect } from 'react';
import {
  Box,
  ThemeProvider,
  CssBaseline,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography
} from '@mui/material';
import { supabase } from './services/supabase';
import { chatApi, quizApi, documentApi } from './services/api';
import { NavTab, ChatSessionItem, QuizSessionSummary, DocumentItem } from './types';
import { lightTheme, darkTheme } from './theme/theme';
import { PrimaryRail } from './components/PrimaryRail';
import { SecondaryBar } from './components/SecondaryBar';
import { TertiaryHistoryBar } from './components/TertiaryHistoryBar';
import { ProfileModal } from './components/ProfileModal';
import { AuthScreen } from './screens/AuthScreen';
import { ChatScreen } from './screens/ChatScreen';
import { QuizScreen } from './screens/QuizScreen';
import { DocumentsScreen } from './screens/DocumentsScreen';

export const App: React.FC = () => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('sb_theme') === 'dark';
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('sb_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Navigation state (Bar 1, Bar 2, Bar 3)
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  // History Bar is closed by default, opens only when user explicitly clicks it in SecondaryBar
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // User Profile Modal
  const [profileOpen, setProfileOpen] = useState(false);

  // Chat Data
  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Quiz Data
  const [quizSessions, setQuizSessions] = useState<QuizSessionSummary[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // Documents (for modal selection)
  const [readyDocs, setReadyDocs] = useState<DocumentItem[]>([]);

  // "New Chat" Modal State
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatDocId, setNewChatDocId] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);

  // "New Quiz" Modal State
  const [newQuizModalOpen, setNewQuizModalOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDocId, setNewQuizDocId] = useState('');
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch initial chat, quiz, and document lists when user logs in
  const refreshChatData = async () => {
    try {
      const sessions = await chatApi.getHistory();
      setChatSessions(sessions);
      if (sessions.length > 0) {
        if (!selectedChatId || !sessions.some((s) => s.id === selectedChatId || (s as any).session_id === selectedChatId)) {
          setSelectedChatId(sessions[0].id || (sessions[0] as any).session_id);
        }
      } else {
        setSelectedChatId(null);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const refreshQuizData = async () => {
    try {
      const quizzes = await quizApi.getSidebarHistory();
      setQuizSessions(quizzes);
      if (quizzes.length > 0) {
        if (!selectedQuizId || !quizzes.some((q) => q.session_id === selectedQuizId || (q as any).id === selectedQuizId)) {
          setSelectedQuizId(quizzes[0].session_id || (quizzes[0] as any).id);
        }
      } else {
        setSelectedQuizId(null);
      }
    } catch (err) {
      console.error('Failed to load quiz history:', err);
    }
  };

  const refreshReadyDocs = async () => {
    try {
      const docs = await documentApi.getAll();
      const ready = docs.filter((d) => (d.status || '').trim().toUpperCase() === 'READY');
      setReadyDocs(ready);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshChatData();
      refreshQuizData();
      refreshReadyDocs();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Chat Actions
  const handleCreateChat = async () => {
    if (!newChatTitle.trim() || !newChatDocId) return;
    setCreatingChat(true);

    try {
      const created = await chatApi.createSession(newChatTitle.trim(), newChatDocId);
      const chosenDoc = readyDocs.find((d) => d.id === newChatDocId);
      if (chosenDoc) {
        try {
          localStorage.setItem(`sb_session_doc_${created.id}`, chosenDoc.id);
          localStorage.setItem(`sb_session_doc_name_${created.id}`, chosenDoc.name);
        } catch {}
      }
      setNewChatModalOpen(false);
      setNewChatTitle('');
      setNewChatDocId('');
      await refreshChatData();
      setSelectedChatId(created.id);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create chat:', err);
    } finally {
      setCreatingChat(false);
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    await chatApi.renameSession(id, newTitle);
    await refreshChatData();
  };

  const handleDeleteChats = async (ids: string[]) => {
    await chatApi.batchDelete(ids);
    if (selectedChatId && ids.includes(selectedChatId)) {
      setSelectedChatId(null);
    }
    await refreshChatData();
  };

  // Quiz Actions
  const handleCreateQuiz = async () => {
    if (!newQuizTitle.trim() || !newQuizDocId) return;
    setCreatingQuiz(true);

    try {
      const created = await quizApi.setupSession(newQuizTitle.trim(), newQuizDocId);
      setNewQuizModalOpen(false);
      setNewQuizTitle('');
      setNewQuizDocId('');
      await refreshQuizData();
      setSelectedQuizId(created.session_id);
      setActiveTab('quiz');
    } catch (err) {
      console.error('Failed to setup quiz:', err);
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleRenameQuiz = async (id: string, newTitle: string) => {
    await quizApi.renameSession(id, newTitle);
    await refreshQuizData();
  };

  const handleDeleteQuizzes = async (ids: string[]) => {
    await quizApi.batchDelete(ids);
    if (selectedQuizId && ids.includes(selectedQuizId)) {
      setSelectedQuizId(null);
    }
    await refreshQuizData();
  };

  // Loading screen during auth session hydrate
  if (authChecking) {
    return (
      <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
        <CssBaseline />
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  // Not signed in -> Auth Screen
  if (!user) {
    return (
      <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
        <CssBaseline />
        <AuthScreen onAuthSuccess={() => refreshChatData()} />
      </ThemeProvider>
    );
  }

  const activeChatSession =
    chatSessions.find((c) => (c.id && c.id === selectedChatId) || ((c as any).session_id && (c as any).session_id === selectedChatId)) ||
    (chatSessions.length > 0 && selectedChatId ? chatSessions[0] : null);

  const activeQuizSession =
    quizSessions.find((q) => (q.session_id && q.session_id === selectedQuizId) || ((q as any).id && (q as any).id === selectedQuizId)) ||
    (quizSessions.length > 0 && selectedQuizId ? quizSessions[0] : null);

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {/* BAR 1: Primary Vertical Rail (Far Left, 64px) */}
        <PrimaryRail
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsHistoryOpen(false); // Only open history when user explicitly clicks "Chat History" or "Quiz History"
          }}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          onOpenProfile={() => setProfileOpen(true)}
          userEmail={user.email}
        />

        {/* BAR 2: Secondary Workspace Bar (Compact: 165px) */}
        <SecondaryBar
          activeTab={activeTab}
          isHistoryOpen={isHistoryOpen}
          onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
          onNewAction={() => {
            refreshReadyDocs();
            if (activeTab === 'chat') {
              setNewChatModalOpen(true);
            } else if (activeTab === 'quiz') {
              setNewQuizModalOpen(true);
            }
          }}
          activeCount={activeTab === 'chat' ? chatSessions.length : quizSessions.length}
        />

        {/* BAR 3: Tertiary History Bar (Compact: 235px - Opens ONLY when clicked in Bar 2) */}
        {isHistoryOpen && activeTab !== 'documents' && (
          <TertiaryHistoryBar
            activeTab={activeTab}
            onClose={() => setIsHistoryOpen(false)}
            chatSessions={chatSessions}
            selectedChatId={selectedChatId}
            onSelectChat={(id) => setSelectedChatId(id)}
            onRenameChat={handleRenameChat}
            onDeleteChats={handleDeleteChats}
            quizSessions={quizSessions}
            selectedQuizId={selectedQuizId}
            onSelectQuiz={(id) => setSelectedQuizId(id)}
            onRenameQuiz={handleRenameQuiz}
            onDeleteQuizzes={handleDeleteQuizzes}
          />
        )}

        {/* MAIN CANVAS WINDOW */}
        <Box sx={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
          {activeTab === 'chat' && (
            <ChatScreen
              currentSession={activeChatSession}
              readyDocs={readyDocs}
              onSessionUpdated={refreshChatData}
              userEmail={user.email}
              onOpenNewChatModal={() => {
                refreshReadyDocs();
                setNewChatModalOpen(true);
              }}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizScreen
              currentQuizSession={activeQuizSession}
              onQuizUpdated={refreshQuizData}
              onOpenNewQuizModal={() => {
                refreshReadyDocs();
                setNewQuizModalOpen(true);
              }}
            />
          )}

          {activeTab === 'documents' && <DocumentsScreen />}
        </Box>
      </Box>

      {/* "New Chat" Dialog */}
      <Dialog open={newChatModalOpen} onClose={() => setNewChatModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Start New Chat Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Session Title"
              fullWidth
              required
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder="e.g. Database Normalization Q&A"
            />

            <FormControl fullWidth required>
              <InputLabel>Attach Knowledge Document</InputLabel>
              <Select
                value={newChatDocId}
                label="Attach Knowledge Document"
                onChange={(e) => setNewChatDocId(e.target.value)}
              >
                {readyDocs.length === 0 ? (
                  <MenuItem disabled value="">
                    No READY documents available. Please upload one first.
                  </MenuItem>
                ) : (
                  readyDocs.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      📄 {doc.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewChatModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateChat}
            disabled={!newChatTitle.trim() || !newChatDocId || creatingChat}
          >
            {creatingChat ? 'Creating...' : 'Create Chat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* "New Quiz" Dialog */}
      <Dialog open={newQuizModalOpen} onClose={() => setNewQuizModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Initialize Quiz Assessment</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Quiz Title"
              fullWidth
              required
              value={newQuizTitle}
              onChange={(e) => setNewQuizTitle(e.target.value)}
              placeholder="e.g. SQL Indexing Mastery Exam"
            />

            <FormControl fullWidth required>
              <InputLabel>Source Document</InputLabel>
              <Select
                value={newQuizDocId}
                label="Source Document"
                onChange={(e) => setNewQuizDocId(e.target.value)}
              >
                {readyDocs.length === 0 ? (
                  <MenuItem disabled value="">
                    No READY documents available. Please upload one first.
                  </MenuItem>
                ) : (
                  readyDocs.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      📄 {doc.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {quizSessions.length >= 50 && (
              <Typography variant="caption" color="error">
                Active quiz limit reached (50 max). Please delete an older quiz before creating a new one.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewQuizModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateQuiz}
            disabled={!newQuizTitle.trim() || !newQuizDocId || creatingQuiz || quizSessions.length >= 50}
          >
            {creatingQuiz ? 'Initializing...' : 'Initialize Quiz'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Profile & Statistics Modal */}
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userEmail={user.email || ''}
        totalDocuments={readyDocs.length}
        totalChats={chatSessions.length}
        totalQuizzes={quizSessions.length}
        maxQuizzes={50}
      />
    </ThemeProvider>
  );
};

export default App;
