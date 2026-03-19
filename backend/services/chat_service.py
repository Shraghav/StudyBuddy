import json
import os
from typing import List
from uuid import UUID
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
load_dotenv()
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq

from repository.chat_repository import ChatRepository
from repository.document_repository import DocumentRepository
from sqlalchemy.ext.asyncio import AsyncSession


class ChatService:
    @staticmethod
    async def ask_question(db: AsyncSession, session_id: UUID, document_id: UUID, question: str):
        """
        Executes a RAG (Retrieval-Augmented Generation) workflow and streams the response.

        Steps:
        1. Persists the user's message to the database.
        2. Generates embeddings for the question using Google Gemini.
        3. Retrieves the top 5 most relevant document chunks from PostgreSQL.
        4. Queries Llama-3 (via Groq) with streaming enabled.
        5. Yields text chunks via SSE and persists the full answer to the DB upon completion.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): The active chat session ID.
            document_id (UUID): The document ID to provide context.
            question (str): The user's query text.

        Returns:
            StreamingResponse: A server-sent events stream of AI-generated text chunks.
        """
        try:
            await ChatRepository.save_message(db, session_id, "user", question)

            embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
            question_vector = embeddings_model.embed_query(question)
            
            chunks = await DocumentRepository.get_similar_chunks(db, document_id, question_vector, limit=5)
            context = "\n\n".join([c.text_content for c in chunks])
            print(context)
            llm = ChatGroq(
                model_name=os.getenv("MODAL_NAME"), 
                temperature=0.3,
                groq_api_key=os.getenv("GROQ_API_KEY"),
                streaming=True
            )
            prompt = PromptTemplate.from_template(
            """You are StudyBuddy, an intelligent and helpful AI tutor. 
            Use the following pieces of retrieved context to answer the user's question. 
            
            - If the answer is explicitly in the context, state it clearly.
            - If the context strongly implies the answer, you may deduce it.
            - If you truly cannot find the answer in the context, say "I cannot find this specific information in the document."
            - Do not use outside internet knowledge.
            
            Context: 
            {context}
            
            Question: {question}
            
            Helpful Answer:"""
        )
            chain = prompt | llm

            async def event_generator():
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
                    print(f"Error in streaming AI text: {stream_error}")
                    error_msg = json.dumps("\n[Error: Connection lost while generating response.]")
                    yield f"data: {error_msg}\n\n"

            return StreamingResponse(event_generator(), media_type="text/event-stream")

        except Exception as e:
            print(f"Error in ChatService.ask_question: {e}")
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
        except Exception as e:
            print(f"Error in ChatService.create_session: {e}")
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
        except Exception as e:
            print(f"Error in ChatService.create_session: {e}")
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
       except Exception as e:
           print("Error occured in getfullchathistory:", e)
    
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
        except Exception as e:
            print(f"Error in ChatService.update_session_title: {e}")
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
        except Exception as e:
            print(f"Error in ChatService.remove_sessions: {e}")
            raise e