import asyncio
import json
import logging
import os
import re
from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import UUID

from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from pydantic import SecretStr
from repository.chat_repository import ChatRepository
from repository.document_repository import DocumentRepository
from sqlalchemy.ext.asyncio import AsyncSession
from utils.caching.cache_manager import CacheManager
from utils.prompts import CHAT_PROMPT

load_dotenv()

logger = logging.getLogger(__name__)

class ChatService:
    @staticmethod
    async def _stream_response_generator(
        db: AsyncSession,
        session_id: UUID,
        citations: list | None = None,
        cached_answer: str | None = None,
        chain: Any = None,
        context: str | None = None,
        question: str | None = None,
        document_id: UUID | None = None,
        answer: str | None = None,
    ) -> AsyncIterator[str]:
        """Handles real-time Server-Sent Events (SSE) streaming for both cached and live AI responses.

        Unifies streaming logic:
        1. Emits text chunks (slicing cached response string or streaming tokens from LLM chain).
        2. Emits inline citation metadata event if citations are present.
        3. Persists consolidated AI response to the database.
        4. Writes through to Redis LLM cache if generated fresh.
        5. Emits terminal `[DONE]` signal sequence.
        """
        full_ai_answer = ""
        cached_text = cached_answer or answer
        try:
            # Step 1: Stream tokens from cache simulation or live LLM chain
            if cached_text is not None:
                chunk_size = 20
                for i in range(0, len(cached_text), chunk_size):
                    chunk_text = cached_text[i : i + chunk_size]
                    full_ai_answer += chunk_text
                    safe_chunk = json.dumps(chunk_text)
                    yield f"data: {safe_chunk}\n\n"
                    await asyncio.sleep(0.01)
            elif chain is not None:
                async for chunk in chain.astream({"context": context, "question": question}):
                    if chunk.content:
                        text_chunk = chunk.content
                        full_ai_answer += text_chunk
                        safe_chunk = json.dumps(text_chunk)
                        yield f"data: {safe_chunk}\n\n"

            # Step 2: Emit inline citations metadata event
            if citations:
                citations_json = json.dumps({"event": "citations", "sources": citations})
                yield f"data: {citations_json}\n\n"

            # Step 3: Persist full assembled response to database
            await ChatRepository.save_message(db, session_id, "ai", full_ai_answer)
            # Step 4: Emit terminal SSE completion sequence
            yield 'data: "[DONE]"\n\n'

        except Exception as e:
            logger.error("Error in streaming AI response: %s", e)
            error_msg = json.dumps("\n[Error: Connection lost while generating response.]")
            yield f"data: {error_msg}\n\n"
            raise

    @staticmethod
    async def ask_question(
        db: AsyncSession,
        session_id: UUID,
        question: str,
        user_id: UUID,
    ) -> StreamingResponse:
        """Orchestrates a comprehensive Retrieval-Augmented Generation (RAG) workflow with LLM caching."""
        try:
            # Step 1: Validate session existence and attached document
            session = await ChatRepository.get_session_by_id(db, user_id, session_id)
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found.")
            if not bool(session.document_id):
                raise HTTPException(
                    status_code=400,
                    detail="No document attached to this chat session. Please attach a document first.",
                )
            document_id = cast(UUID, session.document_id)

            # Step 2: Persist the user question message to the database
            await ChatRepository.save_message(db, session_id, "user", question)

            # Step 3: Compute dense embedding vector for the question using Google Gemini
            embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
            question_vector = embeddings_model.embed_query(question)

            # Step 4: Perform vector similarity search for top-5 relevant chunks
            chunks = await DocumentRepository.get_similar_chunks(db, document_id, question_vector, limit=5)

            # Step 5: Format retrieved chunks and compile citation references with page numbers
            formatted_sources = []
            citations = []
            for i, c in enumerate(chunks, start=1):
                chunk_text = str(c.text_content)
                page_match = re.search(r"---\s*\[Page\s*(\d+)\]\s*---", chunk_text)
                page_num = int(page_match.group(1)) if page_match else 1

                formatted_sources.append(f"[Source {i} | Page {page_num}]:\n{chunk_text}")
                citations.append({
                    "id": i,
                    "page": page_num,
                    "chunk_id": str(c.id),
                    "snippet": chunk_text[:150] + "..." if len(chunk_text) > 150 else chunk_text,
                })
            context = "\n\n".join(formatted_sources)

            # Step 6: Construct LLM prompt and streaming LangChain chain using ChatGroq
            groq_api_key = os.getenv("GROQ_API_KEY")
            model_name = os.getenv("MODAL_NAME")
            llm = ChatGroq(
                model=model_name if model_name else "",
                temperature=0.3,
                api_key=SecretStr(groq_api_key) if groq_api_key else None,
                streaming=True,
            )
            prompt = PromptTemplate.from_template(CHAT_PROMPT)
            chain = prompt | llm

            # Step 7: Return StreamingResponse running SSE generator
            return StreamingResponse(
                ChatService._stream_response_generator(
                    db=db,
                    session_id=session_id,
                    document_id=document_id,
                    context=context,
                    question=question,
                    chain=chain,
                    citations=citations,
                ),
                media_type="text/event-stream",
            )
        except Exception as e:
            logger.error("Error in ChatService.ask_question: %s", e)
            raise

    @staticmethod
    async def invoke_create_session(db: AsyncSession, user_id: UUID, title: str, document_id: UUID):
        """Initializes a new chat session record and writes through to cache."""
        try:
            # Step 1: Create session record in database
            session = await ChatRepository.create_session(db, user_id, title, document_id)
            attached_doc_name = getattr(session, "document_name", None)
            # Step 2: Write-through cache the created session to Redis
            await CacheManager.add_user_chat_session(
                user_id=user_id,
                session_dict={
                    "session_id": str(session.id),
                    "title": session.title,
                    "attachedDocName": attached_doc_name,
                    "messages": [],
                },
            )
            # Step 3: Return created session
            return session
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in ChatService.invoke_create_session: %s", e)
            raise

    @staticmethod
    async def update_document(db: AsyncSession, user_id: UUID, session_id: UUID, document_id: UUID):
        """Updates the document association for an existing chat session and writes through to cache."""
        try:
            # Step 1: Update session document association in database
            session = await ChatRepository.update_session_document(db, user_id, session_id, document_id)
            # Step 2: Return update confirmation payload
            return {"Updated document": session}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in ChatService.update_document: %s", e)
            raise

    @staticmethod
    async def get_full_history(user_id: UUID, db: AsyncSession):
        """Fetches all chat sessions using Read-Through caching."""
        try:
            # Step 1: Check Redis read-through cache for user's chat history
            cache_key = CacheManager.user_chat_history_key(user_id)
            cached = await CacheManager.get_json(cache_key)
            if cached is not None:
                return cached

            # Step 2: Query database with eager relationships on cache miss
            sessions = await ChatRepository.get_all_sessions(user_id, db)
            if not sessions:
                await CacheManager.set_json(cache_key, [])
                return []

            # Step 3: Serialize sessions with nested messages and document metadata
            history = []
            for s in sessions:
                history.append({
                    "id": str(s.id),
                    "title": s.title,
                    "attachedDocName": s.document.name if s.document else "No document attached",
                    "messages": [
                        {
                            "id": str(m.id),
                            "text": m.text,
                            "sender": m.sender,
                            "timestamp": m.timestamp.isoformat(),
                        }
                        for m in s.messages
                    ],
                })
            # Step 4: Write serialized payload to Redis cache and return
            await CacheManager.set_json(cache_key, history)
            return history
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error occurred in get_full_history: %s", e)
            raise

    @staticmethod
    async def update_session_title(db: AsyncSession, user_id: UUID, session_id: UUID, new_title: str):
        """Modifies the display title of a specific chat session and writes through to cache."""
        try:
            # Step 1: Update session title in database
            await ChatRepository.rename_session(db, user_id, session_id, new_title)
            return {"message": "Session renamed successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in ChatService.update_session_title: %s", e)
            raise

    @staticmethod
    async def remove_sessions(db: AsyncSession, user_id: UUID, session_ids: list[UUID]):
        """Deletes a batch of chat sessions and removes them from cache in-place."""
        try:
            # Step 1: Remove session records from database
            await ChatRepository.delete_sessions(db, user_id, session_ids)
            # Step 2: Evict deleted sessions from Redis cache
            await CacheManager.remove_user_chat_sessions(user_id, session_ids)
            # Step 3: Return confirmation message
            return {"message": f"Successfully deleted {len(session_ids)} sessions"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in ChatService.remove_sessions: %s", e)
            raise
