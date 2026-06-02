# StudyBuddy

A full-stack mobile app designed to help users interact with their study materials. It allows users to upload PDF documents, store them securely in the cloud, and ask context-aware questions about the content using an AI-powered chat interface.

## Tech Stack

* **Frontend:** React Native (TypeScript) with Expo
* **Backend:** FastAPI (Python) and render.com for deployment
* **Database & Storage:** PostgreSQL and Cloud Storage via Supabase

---

## Features
### 1. User Authentication (Login & Signup)
* **Secure Signup:** New users can create an account using their email and password. Authentication is managed by Supabase Auth, which handles the secure creation of the user identity.
* **Dual-Table User Syncing:** Upon successful signup, the system coordinates between two database layers:
  1. **User Auth:** Stores primary credentials and session metadata.
  2. **User Public:** A secondary table that stores essential user profile details, ensuring public-facing data is accessible without exposing sensitive auth credentials.
* **Access Token Management:** After Supabase validates the user, the app utilizes apiClient.ts to attach an access token to subsequent requests. This allows the backend to securely identify the user and store their unique ID in local storage for session persistence.
* **Error Handling:** Both Login and Signup screens include real-time validation to catch and display specific errors related to email formatting or password requirements

  
### 2. Document Management (Upload Screen)

* **Upload Documents:** Users can pick and upload a single PDF at a time using the React Native file picker. A built-in cooldown prevents spamming uploads.
* **Cloud Integration:** Files are sent to the FastAPI backend, where the physical file is stored in Supabase Storage, and the document metadata/URL is saved in the PostgreSQL database. A spinning loader indicates the background processing status.
* **File Actions Modal:** Tapping a displayed file opens a modal with three options:
  1. **Select File:** Marks the file for batch selection.
  2. **Save Name:** Renames the file via a text input.
  3. **Cancel:** Closes the modal without making changes.
* **Batch Deletion:** Once files are selected, top-bar action buttons appear allowing the user to either cancel the selection or delete the files. Deleting removes the database record and the metadata file from Supabase storage.
* **Comprehensive API:** The upload functionality is supported by 4 backend endpoints for uploading, renaiming, deleting and getting the relevant documents for the respective users


### 3. AI Chat Assistant (Chat Screen & Drawer)

* **Session Management:** Users can navigate to the Chat tab and use the Chat Drawer to create a new session.
* **Document Context:** To ask questions, users must first attach a previously uploaded document to the active chat session. The AI's answers are generated based on the attached document.
* **Drawer Controls:** Similar to the upload screen, the drawer allows users to long-press chat sessions to rename them or perform batch deletions.
* **Comprehensive API:** The chat functionality is supported by 6 backend endpoints for handling session creation, deletion, renaming quiz title, fetching history, attaching documents, and processing the chat Q&A for the respective users.

### 4. Dynamic Quiz Engine (Quiz Screen & Drawer)

* **Session Management:** Users can navigate to quiz tab and use quiz drawer to create a new session.
* **Input Parameters:** Before generating quiz the user should attach the previously uploaded document along with number of questions, difficulty level and an optional instruction field
* **Drawer Controls:** Similar to Chat Drawer
* **AI Quiz Generation:** The backend leverages a hybrid text and OCR extraction pipeline to parse the document, immediately offloading the processing to a background worker that generates multiple-choice questions via LangChain and Groq AI.
* **Status Polling & MCQ Evaluation:** The app dynamically polls the backend to monitor generation states until the quiz becomes active. Upon user completion, multiple-choice answers are graded instantly against the database records using an optimized lookup map.
* **Comprehensive API:** The quiz functionality is supported by 8 backend endpoints for handling session creation, status polling, attaching documents, renaming quiz title, generating mcq, fetching generated questions, processing MCQ submissions, and managing session removal.
---

## Prerequisites

Before running the project, ensure you have the following installed on your system:

* [Docker](https://www.docker.com/) & Docker Compose
* [Node.js](https://nodejs.org/) (LTS recommended)
* [Expo CLI](https://docs.expo.dev/get-started/installation/)
* A Supabase account (for PostgreSQL and Storage configuration)

---

## Running the Application

### 1. Backend (FastAPI via Docker)

Navigate to the study_buddy directory and spin up the Docker containers.

```bash
cd study_buddy
docker compose build
docker compose up

```

**API Documentation:** Once the Docker container is running, FastAPI automatically generates interactive API documentation. You can access the Swagger UI by navigating to `http://localhost:8000/docs` in your browser.

### 2. Frontend (React Native via Expo)

Before starting the mobile app, you need to point the frontend to your local backend.

1. Navigate to the mobile directory.
2. Open `apiclient.ts` and change the base URL to point to your local backend:
```typescript
// Example inside apiclient.ts
baseURL: "http://localhost:8000" // Ensure this matches your network setup if testing on a physical device

```



Run the application using Expo:

```bash
# To run the app using Expo Go or an emulator
npx expo start

# To create a physical build (requires prebuild setup)
npx expo run

```

---
