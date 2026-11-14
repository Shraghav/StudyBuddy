import axios from 'axios';
import { supabase } from './supabase';
import {
  CitationItem,
  DocumentItem,
  ChatSessionItem,
  QuizSessionSummary,
  QuizDetail,
  QuizGenerationParams
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Supabase access token to every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== DOCUMENTS API ====================
export const documentApi = {
  async getAll(): Promise<DocumentItem[]> {
    const res = await apiClient.get<DocumentItem[]>('/documents/');
    return res.data;
  },

  async upload(name: string, file_url: string): Promise<DocumentItem> {
    const res = await apiClient.post<DocumentItem>('/documents/upload', { name, file_url });
    return res.data;
  },

  async rename(docId: string, newName: string): Promise<DocumentItem> {
    const res = await apiClient.patch<DocumentItem>(`/documents/${docId}/rename`, {
      new_name: newName
    });
    return res.data;
  },

  async batchDelete(docIds: string[]): Promise<any> {
    const res = await apiClient.delete('/documents/batch', {
      data: docIds
    });
    return res.data;
  }
};

// ==================== CHAT API ====================
export const chatApi = {
  async getHistory(): Promise<ChatSessionItem[]> {
    const res = await apiClient.get<{ status: string; sessions: any[] }>(
      '/chat/sessions/all'
    );
    return (res.data.sessions || []).map((s) => {
      const sid = s.id || s.session_id;
      let docId = s.document_id;
      let docName = s.attachedDocName;
      if (!docId && sid) {
        try {
          docId = localStorage.getItem(`sb_session_doc_${sid}`) || undefined;
        } catch { }
      }
      if ((!docName || docName === 'No document attached') && sid) {
        try {
          docName = localStorage.getItem(`sb_session_doc_name_${sid}`) || docName;
        } catch { }
      }
      return {
        ...s,
        id: sid,
        session_id: sid,
        title: s.title || 'Untitled Chat',
        document_id: docId,
        attachedDocName: docName,
        messages: s.messages || []
      };
    });
  },

  async createSession(title: string, documentId: string): Promise<ChatSessionItem> {
    const res = await apiClient.post<{ status: string; session: any }>(
      '/chat/sessions',
      { title, document_id: documentId }
    );
    const s = res.data.session;
    const sid = s.id || s.session_id;
    if (sid && documentId) {
      try {
        localStorage.setItem(`sb_session_doc_${sid}`, documentId);
      } catch { }
    }
    return {
      ...s,
      id: sid,
      session_id: sid,
      title: s.title,
      document_id: documentId || s.document_id,
      messages: []
    };
  },

  async renameSession(sessionId: string, newTitle: string): Promise<any> {
    const res = await apiClient.patch(`/chat/sessions/${sessionId}/rename`, {
      title: newTitle
    });
    return res.data;
  },

  async batchDelete(sessionIds: string[]): Promise<any> {
    const res = await apiClient.delete('/chat/sessions/bulk-delete', {
      data: sessionIds
    });
    return res.data;
  },

  /**
   * SSE Stream reader for chat messages
   */
  async streamMessage(
    sessionId: string,
    question: string,
    onToken: (token: string) => void,
    onCitations: (citations: CitationItem[]) => void,
    onDone: () => void,
    onError: (err: any) => void
  ): Promise<() => void> {
    const abortController = new AbortController();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const response = await fetch(`${API_BASE_URL}/chat/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ question }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Chat request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported.');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const payload = trimmed.substring(5).trim();
              if (payload === '"[DONE]"') {
                onDone();
                return;
              }

              try {
                const parsed = JSON.parse(payload);
                if (typeof parsed === 'string') {
                  onToken(parsed);
                } else if (parsed && parsed.event === 'citations') {
                  onCitations(parsed.sources || []);
                }
              } catch {
                // If not JSON, emit raw string
                onToken(payload);
              }
            }
          }
          onDone();
        } catch (streamErr: any) {
          if (streamErr.name !== 'AbortError') {
            onError(streamErr);
          }
        }
      })();
    } catch (err: any) {
      onError(err);
    }

    return () => abortController.abort();
  }
};

// ==================== QUIZ API ====================
export const quizApi = {
  async getSidebarHistory(): Promise<QuizSessionSummary[]> {
    const res = await apiClient.get<any[]>('/quiz/');
    return (res.data || []).map((q) => {
      const statusRaw = String(q.status || 'setup').toLowerCase();
      const statusClean = statusRaw.includes('complete')
        ? 'completed'
        : statusRaw.includes('active')
          ? 'active'
          : statusRaw.includes('gen')
            ? 'generating'
            : statusRaw.includes('error')
              ? 'error'
              : 'setup';

      return {
        session_id: q.session_id || q.id,
        title: q.title || 'Untitled Quiz',
        document_id: q.document_id || null,
        status: statusClean as any,
        total_questions: q.total_questions
      };
    });
  },

  async setupSession(title: string, documentId: string): Promise<QuizSessionSummary> {
    const res = await apiClient.post<{ status: string; session: any }>('/quiz/sessions', {
      title,
      document_id: documentId
    });
    const s = res.data.session;
    return {
      session_id: s.session_id || s.id,
      title: s.title,
      document_id: s.document_id || documentId || null,
      status: (String(s.status || 'setup').toLowerCase()) as any
    };
  },

  async triggerGeneration(sessionId: string, params: QuizGenerationParams): Promise<any> {
    const res = await apiClient.post(`/quiz/${sessionId}/generate`, params);
    return res.data;
  },

  async pollStatus(sessionId: string): Promise<QuizDetail> {
    const res = await apiClient.get<QuizDetail>(`/quiz/${sessionId}`);
    return res.data;
  },

  async submitAnswers(
    sessionId: string,
    answers: { question_id: string; user_answer: string }[]
  ): Promise<{ message: string; status: string; score: number }> {
    const res = await apiClient.post(`/quiz/${sessionId}/submit`, answers);
    return res.data;
  },

  async renameSession(sessionId: string, newTitle: string): Promise<any> {
    const res = await apiClient.patch(`/quiz/sessions/${sessionId}/rename`, {
      title: newTitle
    });
    return res.data;
  },

  async batchDelete(sessionIds: string[]): Promise<any> {
    const res = await apiClient.delete('/quiz/sessions/bulk-delete', {
      data: sessionIds
    });
    return res.data;
  }
};

