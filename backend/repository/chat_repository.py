from typing import List
from uuid import UUID

from repository.models import ChatMessage, ChatSession
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

class ChatRepository:

    @staticmethod
    async def create_session(db: AsyncSession, user_id: UUID, title: str, document_id: UUID = None):
        """
        Persists a new ChatSession record in the database.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user owning the session.
            title (str): The display title of the chat session.
            document_id (UUID, optional): The ID of the document to link initially. Defaults to None.

        Returns:
            ChatSession: The created and refreshed database session object.

        Raises:
            Exception: If the database insertion or commit fails, with an automatic rollback.
        """
        try:
            new_session = ChatSession(user_id=user_id, title=title, document_id=document_id)
            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)
            return new_session
        except Exception as e:
            await db.rollback()
            print(f"Error in ChatRepository.create_session: {e}")
            raise e

    @staticmethod
    async def save_message(db: AsyncSession, session_id: UUID, sender: str, text: str):
        """
        Inserts a new ChatMessage record into the database.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): ID of the session the message belongs to.
            sender (str): The role of the sender (e.g., 'user' or 'ai').
            text (str): The content of the message.

        Returns:
            ChatMessage: The newly created message object.

        Raises:
            Exception: If the database operation fails, with an automatic rollback.
        """
        try:
            new_msg = ChatMessage(session_id=session_id, sender=sender, text=text)
            db.add(new_msg)
            await db.commit()
            return new_msg
        except Exception as e:
            await db.rollback()
            print(f"Error in ChatRepository.save_message: {e}")
            raise e

    @staticmethod
    async def get_session_messages(db: AsyncSession, session_id: UUID):
        """
        Retrieves all messages associated with a specific session, ordered by time.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): The unique identifier of the chat session.

        Returns:
            List[ChatMessage]: A list of message objects ordered chronologically.

        Raises:
            Exception: If the retrieval query fails.
        """
        try:
            query = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc())
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            print(f"Error in ChatRepository.get_session_messages: {e}")
            raise e
    
    @staticmethod
    async def update_session_document(db: AsyncSession, session_id: UUID, document_id: UUID):
        """
        Performs an update operation to link a document to an existing chat session.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): The identifier of the session to update.
            document_id (UUID): The identifier of the document to link.

        Returns:
            bool: True if the update operation was successful.

        Raises:
            Exception: If the update fails, with an automatic rollback.
        """
        try:
            query = (
                update(ChatSession)
                .where(ChatSession.id == session_id)
                .values(document_id=document_id)
            )
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            print(f"Error in ChatRepository.update_session_document: {e}")
            await db.rollback()
            raise e
        
    @staticmethod
    async def get_all_sessions(db: AsyncSession):
        """
        Queries all chat sessions with their related messages and document metadata.

        Uses eager loading (selectinload) to efficiently retrieve nested relationships 
        for the history view, sorted by creation date (newest first).

        Args:
            db (AsyncSession): Database session dependency.

        Returns:
            List[ChatSession]: A list of all session objects with relationships loaded.

        Raises:
            Exception: If the complex join/retrieval query fails.
        """
        try:
            query = (
                select(ChatSession)
                .options(
                    selectinload(ChatSession.messages),
                    selectinload(ChatSession.document)
                )
                .order_by(ChatSession.created_at.desc()) # Newest first
            )
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            print(f"Error in ChatRepository.get_all_sessions: {e}")
            raise e
    
    @staticmethod
    async def rename_session(db: AsyncSession, session_id: UUID, new_title: str):
        """
        Updates the title field for a specific ChatSession record.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): The unique identifier of the session to rename.
            new_title (str): The new string to set as the session title.

        Returns:
            bool: True if the commit was successful.

        Raises:
            Exception: If the title update fails, with an automatic rollback.
        """
        try:
            query = (
                update(ChatSession)
                .where(ChatSession.id == session_id)
                .values(title=new_title)
            )
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            print(f"Error in ChatRepository.rename_session: {e}")
            raise e

    @staticmethod
    async def delete_sessions(db: AsyncSession, session_ids: List[UUID]):
        """
        Removes multiple ChatSession records based on a provided list of IDs.

        Args:
            db (AsyncSession): Database session dependency.
            session_ids (List[UUID]): A list of UUIDs representing the sessions to delete.

        Returns:
            bool: True if the deletion and commit were successful.

        Raises:
            Exception: If the batch deletion fails, with an automatic rollback.
        """
        try:
            query = (
                delete(ChatSession)
                .where(ChatSession.id.in_(session_ids))
            )
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            print(f"Error in ChatRepository.delete_sessions: {e}")
            raise e