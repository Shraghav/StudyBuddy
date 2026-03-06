import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Question {
  id: string;
  text: string;
  type: "mcq" | "text";
  options?: string[];
  correctAnswer: string;
}

export interface QuizSession {
  id: string;
  title: string;
  documentId?: string;
  documentName?: string;
  status: "setup" | "active" | "completed";
  setupParams: {
    numQuestions: string;
    difficulty: "Easy" | "Medium" | "Hard";
    format: "mcq" | "text";
    customPrompt: string;
  };
  questions: Question[];
  userAnswers: Record<string, string>; 
  score: number;
  feedback: string;
}

interface QuizState {
  sessions: QuizSession[];
  currentSessionId: string | null;
}

const initialState: QuizState = { sessions: [], currentSessionId: null };

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    createNewQuiz: (state, action: PayloadAction<string>) => {
      const newQuiz: QuizSession = {
        id: action.payload,
        title: `Quiz ${state.sessions.length + 1}`,
        status: "setup",
        setupParams: {
          numQuestions: "5",
          difficulty: "Medium",
          format: "mcq",
          customPrompt: "",
        },
        questions: [],
        userAnswers: {},
        score: 0,
        feedback: "",
      };
      state.sessions.unshift(newQuiz);
      state.currentSessionId = newQuiz.id;
    },
    switchQuizSession: (state, action: PayloadAction<string>) => {
      state.currentSessionId = action.payload;
    },
    updateSetupParams: (
      state,
      action: PayloadAction<Partial<QuizSession["setupParams"]>>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session)
        session.setupParams = { ...session.setupParams, ...action.payload };
    },
    setDocumentForQuiz: (
      state,
      action: PayloadAction<{ id: string; name: string }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.documentId = action.payload.id;
        session.documentName = action.payload.name;
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
      if (session)
        session.userAnswers[action.payload.questionId] = action.payload.answer;
    },
    submitQuiz: (state) => {
      const session = state.sessions.find(
        (s) => s.id === state.currentSessionId,
      );
      if (session) {
        session.status = "completed";
        const mcqQuestions = session.questions.filter((q) => q.type === "mcq");
        let correctCount = 0;

        mcqQuestions.forEach((q) => {
          if (session.userAnswers[q.id] === q.correctAnswer) correctCount++;
        });

        session.score = correctCount;
        session.feedback =
          mcqQuestions.length > 0
            ? `You got ${correctCount} out of ${mcqQuestions.length} multiple choice questions right. AI is analyzing your text responses...`
            : "Quiz submitted! AI is now grading your long-form answers.";
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
      // If we delete the active quiz, reset currentId
      if (
        state.currentSessionId &&
        action.payload.includes(state.currentSessionId)
      ) {
        state.currentSessionId = null;
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
  submitQuiz,
  renameQuiz,
  removeQuizzes
} = quizSlice.actions;
export default quizSlice.reducer;
