import json
import logging
import os
from typing import Any, List
from uuid import UUID

from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from utils.prompts import CHAT_PROMPT

load_dotenv()
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from repository.chat_repository import ChatRepository
from repository.document_repository import DocumentRepository
from sqlalchemy.ext.asyncio import AsyncSession
logger = logging.getLogger(__name__)

class ChatService:
    @staticmethod
    async def _stream_event_generator(db: AsyncSession, session_id: UUID, context: str, question: str, chain: Any):
        """Handles real-time text chunk streaming via Server-Sent Events (SSE) and persists results.
        Steps:
        1. Iterates asynchronously over incoming tokens generated from the AI execution chain.
        2. Accumulates raw text segments into a full string while yielding JSON-safe SSE chunks.
        3. Saves the completed consolidated AI response to the database via the repository layer.
        4. Yields a terminal `[DONE]` signal sequence to signify clean stream completion.
        5. Captures mid-stream connection drops or calculation faults to emit an explicit SSE error message.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the active chat session.
            context (str): Unified text context extracted from relevant document chunks.
            question (str): The original search query or message text submitted by the user.
            chain (Any): Combined LangChain runnable pipeline linking prompts and the LLM.

        Returns:
            AsyncIterator[str]: An asynchronous generator emitting formatted SSE data strings.
        """
        full_ai_answer = ""
        try:
            async for chunk in chain.astream({"context": context, "question": question}):
                if chunk.content:
                    text_chunk = chunk.content
                    full_ai_answer += text_chunk
                    safe_chunk = json.dumps(text_chunk)
                    yield f"data: {safe_chunk}\n\n"
            
            await ChatRepository.save_message(db, session_id, "ai", full_ai_answer)                    
            yield "data: \"[DONE]\"\n\n"
            
        except Exception as stream_error:
            logger.error(f"Error in streaming AI text: {stream_error}")
            error_msg = json.dumps("\n[Error: Connection lost while generating response.]")
            yield f"data: {error_msg}\n\n"

    @staticmethod
    async def ask_question(db: AsyncSession, session_id: UUID, document_id: UUID, question: str):
        """Orchestrates a comprehensive Retrieval-Augmented Generation (RAG) workflow.
        Steps:
        1. Persists the initial raw text question from the user straight to the database.
        2. Translates the query string into semantic vectors utilizing Google Gemini Embeddings.
        3. Queries vector tables to pull the top 5 contextually nearest document text chunks.
        4. Combines text pieces into a context block and configures the streaming Llama model pipeline.
        5. Instantiates and returns a streaming network response powered by the event generator.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the target chat session.
            document_id (UUID): Unique file identifier containing the source context knowledge.
            question (str): Raw question text string requiring evaluation.

        Returns:
            StreamingResponse: Real-time network stream wrapper carrying SSE chunk text payloads.
        """
        try:
            await ChatRepository.save_message(db, session_id, "user", question)

            embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
            question_vector = embeddings_model.embed_query(question)
            
            chunks = await DocumentRepository.get_similar_chunks(db, document_id, question_vector, limit=5)
            context = "\n\n".join([c.text_content for c in chunks])
            llm = ChatGroq(
                model_name=os.getenv("MODAL_NAME"), 
                temperature=0.3,
                groq_api_key=os.getenv("GROQ_API_KEY"),
                streaming=True
            )
            prompt = PromptTemplate.from_template(CHAT_PROMPT)
            chain = prompt | llm

            return StreamingResponse(
                ChatService._stream_event_generator(db, session_id, context, question, chain), 
                media_type="text/event-stream"
            )

        except Exception as e:
            logger.error(f"Error in ChatService.ask_question: {e}")
            raise e 
  
    async def invoke_create_session(db: AsyncSession,user_id:UUID,title, document_id: UUID):
        """
        Initializes a new chat session record in the repository.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            title (str): Initial display title for the session.
            document_id (UUID): The identifier of the document to be used for the session.

        Returns:
            Session: The newly created session object.
        """
        try:
            session = await ChatRepository.create_session(db, user_id, title, document_id)
            return session
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in ChatService.create_session: {e}")
            raise e
    
    async def update_document(db: AsyncSession,user_id:UUID,session_id:UUID, document_id: UUID):
        """
        Updates the document association for an existing chat session.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            session_id (UUID): The identifier of the chat session to update.
            document_id (UUID): The identifier of the new document to link.

        Returns:
            dict: Confirmation containing the updated session details.
        """
        try:
            session = await ChatRepository.update_session_document(db,user_id, session_id, document_id)
            return {"Updated document": session}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in ChatService.create_session: {e}")
            raise e
    
    @staticmethod
    async def get_full_history(user_id:UUID, db: AsyncSession):
       """
        Fetches all chat sessions and formats them for the frontend Redux state (ChatSlice.ts).

        Maps database models to the 'ChatSession' interface expected by ChatSlice.

        Args:
            user_id (UUID): The unique identifier of the user
            db (AsyncSession): Database session dependency.

        Returns:
            list[dict]: A list of formatted session objects with message history.
        """
       try:
           sessions = await ChatRepository.get_all_sessions(user_id, db)
           if(len(sessions)<0):
               return
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
                            "timestamp": m.timestamp.isoformat()
                        } for m in s.messages
                    ]
                })
           return history
       except HTTPException:
            raise
       except Exception as e:
           logger.error("Error occured in getfullchathistory:", e)
    
    @staticmethod
    async def update_session_title(db: AsyncSession,user_id:UUID, session_id: UUID, new_title: str):
        """
        Modifies the display title of a specific chat session.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user.
            session_id (UUID): The identifier of the session to be renamed.
            new_title (str): The new title string.

        Returns:
            dict: A success message confirmation.
        """
        try:
            await ChatRepository.rename_session(db,user_id, session_id, new_title)
            return {"message": "Session renamed successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in Chat update_session_title: {e}")
            raise e

    @staticmethod
    async def remove_sessions(db: AsyncSession,user_id:UUID, session_ids: List[UUID]):
        """
        Deletes a batch of chat sessions and their associated message history.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            session_ids (List[UUID]): A list of session identifiers to remove.

        Returns:
            dict: A confirmation message indicating the number of deleted sessions.
        """
        try:
            await ChatRepository.delete_sessions(db, user_id, session_ids)
            return {"message": f"Successfully deleted {len(session_ids)} sessions"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in chat remove_sessions: {e}")
            raise e