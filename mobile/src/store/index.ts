import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/AuthSlice";
import chatReducer from "./slices/ChatSlice";
import fileReducer from "./slices/FileSlice";
import quizReducer from "./slices/QuizSlice";
import themeReducer from "./slices/ThemeSlice";
export const store = configureStore({
  reducer: {
    auth: authReducer,
    files: fileReducer,
    chat: chatReducer,
    quiz: quizReducer,
    theme: themeReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
