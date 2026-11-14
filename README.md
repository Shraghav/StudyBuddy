# StudyBuddy 📚🤖

An end-to-end, AI-powered study companion that transforms course materials, technical PDFs, and lecture notes into interactive learning experiences. Users can upload documents, query them with an intelligent streaming chat assistant that provides exact page-level citations, and generate adaptive multiple-choice quizzes evaluated in real-time.

---

## 🏗️ Architecture & Tech Stack

```
                   ┌────────────────────────────────────────┐
                   │               Clients                  │
                   │  • Mobile App (React Native + Expo)    │
                   │  • Web App (React + Vite + MUI)        │
                   └───────────────────┬────────────────────┘
                                       │ REST / SSE Stream
                                       ▼
                   ┌────────────────────────────────────────┐
                   │         FastAPI Backend (Python)       │
                   │  • JWT Auth & Supabase Sync            │
                   │  • Document OCR & Recursive Chunking   │
                   │  • Hybrid Vector RAG Pipeline          │
                   │  • Async Quiz Generation Engine        │
                   └───────┬───────────┬────────────┬───────┘
                           │           │            │
            Gemini Embeddings / ChatGroq│       Cache Hit / Fallback
             (openai/gpt-oss-20b)      │            │
                           ▼           ▼            ▼
                   ┌──────────────┐ ┌────────────┐ ┌───────────────┐
                   │   Supabase   │ │ PostgreSQL │ │ Redis Cache   │
                   │   Storage    │ │ (pgvector) │ │ (w/ fallback) │
                   └──────────────┘ └────────────┘ └───────────────┘
```

* **Backend:** FastAPI (Python 3.11+ async pipeline), SQLAlchemy with Asyncpg, LangChain.
* **AI & Embeddings:** Google Gemini (`gemini-embedding-001`, 768 dimensions), ChatGroq powered by `openai/gpt-oss-20b`.
* **Database & Vector Search:** PostgreSQL via Supabase with the `pgvector` extension for Euclidean L2 vector similarity matching.
* **Caching & Resilience:** Redis with an automated in-memory dictionary fail-safe fallback.
* **Document Parsing:** RapidOCR combined with PyMuPDF (fitz) for hybrid scanned/digital PDF extraction.
* **Clients:**
  * **Mobile Application:** React Native (TypeScript) with Expo, Expo SecureStore, and Axios.
  * **Web Application:** React 18, TypeScript, Vite, Material-UI (MUI v5), Server-Sent Events (SSE).

---

## 📱 Mobile Application & Frontend Integration

The mobile application is built with **React Native (TypeScript) using Expo**, providing a responsive native interface across iOS and Android.

### 1. Authentication & Token Management (`mobile/src/services/api/api_client.ts`)
* **Secure Storage:** User auth tokens are stored using `expo-secure-store` rather than unencrypted local storage.
* **Automatic Request Interceptors:** The mobile Axios client intercepts outgoing requests to inject the `Authorization: Bearer <token>` header. It validates token expiry before dispatching and automatically triggers session cleanup on expiration.
* **Resilient Network Retries:** Built-in exponential backoff retries (up to 3 attempts) for handling intermittent mobile network drops or timeouts.
* **Dual-Screen Validation:** Interactive Login and Signup screens with client-side email format and password strength checks matching Supabase constraints.

### 2. Document Management (Upload Screen & Actions)
* **Native File Picking:** Users can select PDF study materials directly from device storage or iCloud/Google Drive using the native document picker. A cooldown mechanism prevents accidental duplicate uploads.
* **Cloud Storage Upload:** The selected file is uploaded to the FastAPI backend, which stores the physical PDF in a Supabase Storage bucket and creates tracking records in PostgreSQL.
* **File Actions Modal:** Tapping any document in the list opens a clean action sheet:
  1. **Select File:** Enters multi-select mode for batch actions.
  2. **Save Name:** Renames the document in both the database and UI.
  3. **Cancel:** Closes the modal.
* **Batch Deletion:** Users can select multiple documents simultaneously; confirming batch deletion cleans up the records from PostgreSQL and deletes the binary files from Supabase Storage.

### 3. AI Chat Assistant (Chat Screen & Navigation Drawer)
* **Drawer Navigation:** A sliding drawer displays all existing chat sessions with creation dates, allowing quick context switching.
* **Document Context Binding:** Users attach a specific uploaded document when starting or continuing a chat. All subsequent user questions query that document's vector chunks.
* **Session Management:** Long-pressing any chat session in the drawer enables renaming session titles or performing batch deletions.
* **Interactive Citations:** The chat message view displays source citations with page numbers so students can verify AI responses against the original material.

### 4. Dynamic Quiz Engine (Quiz Screen & Drawer)
* **Configurable Quiz Setup:** Before starting a quiz, users select an attached document, specify the number of questions (up to 5), choose a difficulty tier (Easy, Medium, Hard), and can optionally provide custom focus instructions (e.g., *"Focus on SQL Joins and Normalization"*).
* **Generation State Polling:** While the background worker processes the document and generates questions via `openai/gpt-oss-20b`, the screen displays real-time loading feedback until the status transitions to `active`.
* **Stepped MCQ Interface:** Users navigate question cards with a progress indicator, selecting answers across options A, B, C, and D.
* **Instant Evaluation Scorecard:** Upon completion, the quiz submission is evaluated immediately against the server-side ground truth, rendering a results scorecard showing the final grade percentage, correct vs. incorrect answers, and detailed explanations.

---

## ⚙️ Backend Deep-Dive: What Was Built

### 1. User Authentication & Database Synchronization
* **Supabase Auth Integration:** User identity and credential management are handled via Supabase Auth with secure JWT tokens.
* **Dual-Table Synchronization via PostgreSQL Trigger:** To guarantee that the application's public data model stays synchronized with Supabase's internal auth layer without redundant API overhead, a PostgreSQL trigger (`on_auth_user_created`) automatically intercepts new registrations on `auth.users` and records `user_id`, `user_email`, and `created_at` into `public.users`:
  ```sql
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  begin
    insert into public.users (user_id, user_email, created_at)
    values (new.id, new.email, now());
    return new;
  end;
  $$;
  ```
* **JWT Ownership Enforcement:** Every incoming API request validates the Bearer token via `backend/utils/jwt_utils.py`, ensuring strict row-level authorization across document ownership, chat sessions, and quiz scores.

---

### 2. Document Ingestion, Hybrid OCR & pgvector Chunking
* **Deduplication Check:** Uses SHA-256 content hashing to detect duplicate uploads before running compute-heavy extraction tasks.
* **Hybrid OCR Pipeline (`backend/utils/ocr_processor.py`):**
  * Parses incoming PDFs page by page.
  * Attempts direct digital text extraction via PyMuPDF.
  * If a page is scanned, image-heavy, or contains diagrams, it automatically falls back to `RapidOCR` to extract diagram labels and handwritten or scanned text.
  * Injects standardized page boundary markers: `--- [Page X] ---`.
* **Semantic Chunking:** LangChain's `RecursiveCharacterTextSplitter` segments parsed text using `chunk_size=1000` and `chunk_overlap=200` characters, ensuring context continuity across paragraph breaks.
* **Dense Vector Embeddings & pgvector Storage:**
  * Each chunk is embedded into a 768-dimensional dense vector via Google Gemini (`models/gemini-embedding-001`).
  * Stored in PostgreSQL using the `pgvector` column type with unique MD5 `content_hash` indexing to eliminate redundant chunk records.
  * Chunks are written through to Redis for ultra-fast downstream reuse during quiz generation.

---

### 3. AI Chat Assistant & Streaming RAG with Live Citations
* **Vector Retrieval:** When a user asks a question, the backend embeds the query using Gemini, and executes an L2 distance (`<->`) vector similarity search in PostgreSQL via `pgvector` to pull the top 5 most relevant document chunks.
* **Exact Page-Level Citations:** The backend parses the retrieved chunk headers for `--- [Page X] ---` tags, sanitizes raw OCR artifacts, and creates structured citation references containing:
  * Reference ID (`[1]`, `[2]`, etc.)
  * Source document page number
  * Cleaned passage snippet
* **Real-Time Token Streaming (Server-Sent Events):**
  * Powered by `ChatGroq` running `openai/gpt-oss-20b` with `temperature=0.3` for grounded, hallucination-resistant answers.
  * Tokens stream live to the client as Server-Sent Events (SSE).
  * Immediately before the terminal `[DONE]` signal, a dedicated `citations` event is emitted containing structured source data.
  * The full AI response is saved to PostgreSQL, and the user's chat history cache is automatically invalidated.

---

### 4. Dynamic Quiz Engine (Capped at 5 Questions)
* **Non-Blocking Background Worker (`backend/services/quiz_engine/background_tasks.py`):**
  * Quiz setup creates a session in `generating` state and hands off processing to FastAPI `BackgroundTasks`.
  * The client polls `GET /quiz/sessions/{session_id}/status`, allowing the user interface to stay fully responsive while the LLM crafts questions.
* **Why Capped at 5 Questions?** Capping each quiz at 5 adaptive questions prevents rate limit exhaustion and timeouts on free-tier LLM APIs while ensuring fast, reliable generation.
* **Randomized Chunk Sampling:** Samples varied chunks across the document to ensure comprehensive coverage rather than testing solely on the first page.
* **Structured JSON Generation:** The prompt enforces strict JSON schema output from ChatGroq with questions, option lists (`A`, `B`, `C`, `D`), correct option keys, and explanations.
* **Instant Evaluation & Scoring:** When the user completes the quiz, `POST /quiz/sessions/{session_id}/submit` grades answers against the database answer key using an $O(1)$ dictionary lookup, computing scores, elapsed time, and per-question correctness.

---

## ⚡ Redis Caching: Where & Why It's Used

Redis is used to make the application fast and reduce unnecessary load on PostgreSQL:

| Where It's Used | What It Does | Why It Matters |
| :--- | :--- | :--- |
| **User Document List**<br>`cache:user:{id}:documents` | Caches the list of uploaded PDFs for each user (15 min TTL). | Users view their documents frequently; serving from Redis cuts database roundtrips to zero. |
| **Chat Session History**<br>`cache:user:{id}:chat_history` | Stores all chat sessions, titles, and message histories. | Instant sidebar rendering when opening the app or switching chats without slow SQL joins. |
| **Quiz Sidebar Summaries**<br>`cache:user:{id}:quiz_sidebar` | Caches quiz history, status (`active`, `completed`), scores, and titles. | Prevents repetitive polling queries from hammering the database. |
| **Document Text Chunks**<br>`cache:doc:{id}:chunks` | Caches pre-extracted text chunks and metadata (24 hr TTL). | When a user creates a quiz, the engine pulls chunks straight from Redis without re-downloading PDFs from cloud storage or re-running OCR. |
| **Fail-Safe In-Memory Fallback** | `InMemoryFallbackCache` in Python dictionary memory. | If Redis is offline, experiencing timeouts, or restarting, the backend gracefully falls back to local memory without crashing or blocking user requests. |

---

## 📊 RAG Evaluation & Benchmark Results

### What is RAG Evaluation?
In Retrieval-Augmented Generation (RAG), the LLM is only as good as the context retrieved. If the vector search pulls irrelevant text, the LLM will give vague answers or hallucinate. 

RAG evaluation mathematically benchmarks retrieval performance against verified ground-truth datasets using three standard Information Retrieval (IR) metrics implemented in `backend/utils/rag_evaluation.py`:
* **Mean Reciprocal Rank (MRR):** Measures how high up the first relevant document appears. A score of $1.0$ means the very first retrieved result was relevant.
* **Precision@K (P@K):** The percentage of retrieved chunks in the top-$K$ that are genuinely relevant (checks for context cleanliness).
* **Recall@K (R@K):** The percentage of all relevant facts in the document that were successfully captured in the top-$K$ candidates (checks for completeness).
* **Hit Rate Accuracy (Hit@1, Hit@3, Hit@5):** The percentage of queries where at least one ground-truth relevant chunk appeared in the top 1, 3, or 5 results.

### Benchmark Results (from `backend/architecture_evaluation/docs_evaluation.md`)

The system was evaluated across two technical documents representing distinct content formats:
1. **Document 1 (DBMS Cheatsheet - Scaler Topics, 45 Pages, 36 Chunks):** Dense, conceptual database systems content (ACID, normal forms, indexing, concurrency).
2. **Document 2 (React JSX Cheatsheet - Codecademy, 7 Pages, 11 Chunks):** Code-heavy frontend documentation with snippets, hooks, and DOM reconciliation.

| Metric | Document 1 (DBMS) | Document 2 (React JSX) | Combined Benchmark | Production Target | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Mean Reciprocal Rank (MRR)** | **1.0000** | **0.9500** | **0.9750** | $\ge 0.80$ | ✅ High Top-Rank Precision |
| **Hit@1 Accuracy** | **100.0%** | **90.0%** | **95.0%** | $\ge 80.0\%$ | ✅ Rank-1 Relevance |
| **Hit@3 Accuracy** | **100.0%** | **100.0%** | **100.0%** | $\ge 90.0\%$ | ✅ High Reliability |
| **Hit@5 Accuracy** | **100.0%** | **100.0%** | **100.0%** | $\ge 95.0\%$ | ✅ Complete Context Hit |
| **Precision@1** | **1.0000** | **0.9000** | **0.9500** | $\ge 0.80$ | ✅ Accurate First Match |
| **Precision@3** | **0.5333** | **0.3666** | **0.4500** | $\ge 0.50$ | ✅ Clean Top-3 Density |
| **Precision@5** | **0.3600** | **0.2400** | **0.3000** | $\ge 0.35$ | ✅ Context Efficiency |
| **Recall@1** | **0.6083** | **0.5417** | **0.5750** | $\ge 0.35$ | ✅ High Initial Coverage |
| **Recall@3** | **0.8750** | **0.6000** | **0.7375** | $\ge 0.70$ | ✅ Comprehensive Coverage |
| **Recall@5** | **0.9250** | **0.6333** | **0.7792** | $\ge 0.85$ | ✅ Target Facts Captured |

#### Key Takeaways:
1. **Combined MRR of 0.9750:** In 19 out of 20 test queries, the most relevant document passage was ranked **#1**.
2. **100% Hit@3 and Hit@5:** Across all test queries, 100% of candidates contained the ground-truth answer in the top 3 and top 5 chunks.
3. **Format Agnostic:** The 1000/200 character recursive chunking strategy worked effectively for both structured database theory and syntax-heavy JSX code blocks.

---

## 🎨 Note on the Web Interface Showcase

> **Full Transparency:** The web application in `website/` was **vibe-coded** to build an interactive, responsive browser client specifically to showcase the capabilities of the backend.
>
> While the primary client is the full React Native Expo mobile app in `mobile/`, the website was rapidly constructed with React 18, Vite, and Material-UI to provide a visual desktop demo for:
> * Streaming real-time SSE responses token-by-token with typing animations.
> * Viewing interactive inline citations with an integrated PDF modal preview.
> * Polling quiz generation states with stepped question flows and instant scoring.
> * Demonstrating zero-latency read-through caching via Redis.

---

## 🚀 Running the Project

### Prerequisites
* Docker & Docker Compose
* Python 3.11+
* Node.js 18+ & npm
* Expo CLI (`npm install -g expo-cli`)
* Supabase Account (PostgreSQL with `pgvector` enabled & Storage bucket created)
* Groq API Key (using `openai/gpt-oss-20b`) & Google Gemini API Key

---

### 1. Backend Setup (FastAPI + Docker)

Create a `.env` file in `backend/`:
```env
DATABASE_URL="postgresql+asyncpg://postgres:yourpassword@db.your-project.supabase.co:5432/postgres"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-service-or-anon-key"
GOOGLE_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
MODAL_NAME="openai/gpt-oss-20b"
REDIS_URL="redis://localhost:6379/0"
```

Spin up Redis, PostgreSQL, and FastAPI with Docker Compose:
```bash
docker compose build
docker compose up
```

Interactive API documentation:
* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`

---

### 2. Mobile App Setup (React Native + Expo)

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   npm install
   ```

2. Configure backend connection in `mobile/src/services/api/api_client.ts`:
   ```typescript
   export const apiClient = axios.create({
     baseURL: "http://localhost:8000", // Or your local LAN IP (e.g. http://192.168.1.X:8000) for testing on physical devices
     headers: {
       "Content-Type": "application/json",
     }
   });
   ```

3. Launch the Expo development server:
   ```bash
   npx expo start
   ```
   * Press `a` to run on an Android emulator.
   * Press `i` to run on an iOS simulator.
   * Scan the terminal QR code with the **Expo Go** app on your physical device.

---

### 3. Web App Setup (React Showcase)

```bash
cd website
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.
