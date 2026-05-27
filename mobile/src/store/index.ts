import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";

import authReducer from "./slices/AuthSlice";
import chatReducer from "./slices/ChatSlice";
import fileReducer from "./slices/FileSlice";
import quizReducer from "./slices/QuizSlice";
import themeReducer from "./slices/ThemeSlice";

const quizPersistConfig = {
  key: "quiz",
  storage: AsyncStorage,
};

const persistedQuizReducer = persistReducer(quizPersistConfig, quizReducer);

export const store = configureStore({
  reducer: {
    auth: authReducer,
    files: fileReducer,
    chat: chatReducer,
    quiz: persistedQuizReducer, 
    theme: themeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
