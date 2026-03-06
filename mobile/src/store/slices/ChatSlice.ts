import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  attachedDocName?: string;
  attachedDocId?: string;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
}

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addSession: (state, action: PayloadAction<ChatSession>) => {
      state.sessions.unshift(action.payload);
      state.currentSessionId = action.payload.id;
    },
    switchSession: (state, action: PayloadAction<string>) => {
      state.currentSessionId = action.payload;
    },
    addMessage: (
      state,
      action: PayloadAction<{ sessionId: string; message: Message }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === action.payload.sessionId,
      );
      if (session) {
        session.messages.push(action.payload.message);
      }
    },
    renameSession: (
      state,
      action: PayloadAction<{ id: string; newTitle: string }>,
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) session.title = action.payload.newTitle;
    },
    removeSessions: (state, action: PayloadAction<string[]>) => {
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
    removeFiles: (state, action: PayloadAction<string[]>) => {
      const deletedIds = action.payload; 

      state.sessions = state.sessions.map((session) => {
        if (
          session.attachedDocId &&
          deletedIds.includes(session.attachedDocId)
        ) {
          return {
            ...session,
            attachedDocId: undefined,
            attachedDocName: undefined
          };
        }
        return session;
      });
    },
    attachDocumentToSession: (
      state,
      action: PayloadAction<{ sessionId: string; docName: string, docId:string }>,
    ) => {
      const session = state.sessions.find(
        (s) => s.id === action.payload.sessionId,
      );
      if (session) {
        session.attachedDocName = action.payload.docName;
        session.attachedDocId = action.payload.docId;
      }
    },
    setSessions: (state, action: PayloadAction<ChatSession[]>) => {
      state.sessions = action.payload.filter(
        (s) => s.id !== null && s.id !== undefined,
      );
      if (action.payload.length > 0 && !state.currentSessionId) {
        state.currentSessionId = action.payload[0].id;
      }
    }
  },
});

export const {
  addSession,
  switchSession,
  addMessage,
  renameSession,
  removeSessions,
  attachDocumentToSession,
  setSessions,
  removeFiles,
} = chatSlice.actions;
export default chatSlice.reducer;
