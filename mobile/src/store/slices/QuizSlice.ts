import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Question {
  id: string;
  text: string;
  type: "mcq";
  options?: string[];
  correctAnswer: string;
  userAnswer?: string;
  evaluationScore?: number;
  evaluationFeedback?: string;
}

export interface QuizSession {
  id: string;
  title: string;
  documentId?: string;
  documentName?: string;
  status: "setup" | "active" | "completed" | "generating" | "error" | "";
  setupParams?: {
    numQuestions: string;
    difficulty: "Easy" | "Medium" | "Hard" | "";
    format: "mcq" | "";
    customPrompt: string;
  };
  questions?: Question[];
  userAnswers?: Record<string, string>;
  score?: number;
  feedback?: string;
}

interface QuizState {
  sessions: QuizSession[];
  currentSessionId: string | null;
  isLoading: boolean;
}

const initialState: QuizState = {
  sessions: [],
  currentSessionId: null,
  isLoading: true,
};

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    createNewQuiz: (state, action: PayloadAction<QuizSession>) => {
      state.sessions.unshift(action.payload);
      state.currentSessionId = action.payload.id;
    },
    switchQuizSession: (state, action: PayloadAction<string>) => {
      state.currentSessionId = action.payload;
    },
    setQuizStatus: (
      state,
      action: PayloadAction<{ id: string; status: QuizSession["status"] }>,
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.status = action.payload.status;
      }
    },
    updateSetupParams: (
      state,
      action: PayloadAction<Partial<QuizSession["setupParams"]>>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.setupParams = {
          numQuestions: "",
          difficulty: "",
          format: "",
          customPrompt: "",
          ...session.setupParams,
          ...action.payload,
        };
      }
    },
    setDocumentForQuiz: (
      state,
      action: PayloadAction<{
        sessionId: string;
        docId: string;
        docName: string;
      }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.documentId = action.payload.docId;
        session.documentName = action.payload.docName;
      }
    },
    startQuiz: (state, action: PayloadAction<Question[]>) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.status = "active";
        session.questions = action.payload;
      }
    },
    answerQuestion: (
      state,
      action: PayloadAction<{ questionId: string; answer: string }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session && !session.userAnswers) {
        session.userAnswers = {};
      }
      if (session && session.userAnswers)
        session.userAnswers[action.payload.questionId] = action.payload.answer;
    },
    completeQuiz: (
      state,
      action: PayloadAction<{
        score: number;
        feedback: string;
        questions: Question[];
      }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.status = "completed";
        session.score = action.payload.score;
        session.feedback = action.payload.feedback;
        session.questions = action.payload.questions; // Overwrite with graded data
      }
    },
    renameQuiz: (
      state,
      action: PayloadAction<{ id: string; newTitle: string }>,
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) session.title = action.payload.newTitle;
    },
    removeQuizzes: (state, action: PayloadAction<string[]>) => {
      state.sessions = state.sessions.filter(
        (s) => !action.payload.includes(s.id),
      );
      if (
        state.currentSessionId &&
        action.payload.includes(state.currentSessionId)
      ) {
        state.currentSessionId = null;
      }
    },
    setSessionsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setSessions: (state, action: PayloadAction<QuizSession[]>) => {
      const backendSessions = action.payload.filter(
        (s) => s.id !== null && s.id !== undefined,
      );

      state.sessions = backendSessions.map((incoming) => {
        const localMatch = state.sessions.find((s) => s.id === incoming.id);

        return {
          ...incoming,
          // If the local session has questions/answers, retain them!
          questions: localMatch?.questions || incoming.questions || [],
          userAnswers: localMatch?.userAnswers || incoming.userAnswers || {},
          setupParams: localMatch?.setupParams || incoming.setupParams,
          score:
            incoming.score !== undefined ? incoming.score : localMatch?.score,
          feedback:
            incoming.feedback !== undefined
              ? incoming.feedback
              : localMatch?.feedback,
        };
      });

      if (backendSessions.length > 0 && !state.currentSessionId) {
        state.currentSessionId = backendSessions[0].id;
      }
    },
  },
});

export const {
  createNewQuiz,
  switchQuizSession,
  updateSetupParams,
  setDocumentForQuiz,
  startQuiz,
  answerQuestion,
  completeQuiz,
  renameQuiz,
  removeQuizzes,
  setSessionsLoading,
  setSessions,
  setQuizStatus,
} = quizSlice.actions;
export default quizSlice.reducer;
