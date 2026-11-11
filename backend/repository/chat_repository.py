
from uuid import UUID

from repository.models import ChatMessage, ChatSession
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload


class ChatRepository:

    @staticmethod
    async def create_session(db: AsyncSession, user_id: UUID, title: str, document_id: UUID):
        """
        Persists a new ChatSession record in the database.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            title (str): The display title of the chat session.
            document_id (UUID, optional): The ID of the document to link initially. Defaults to None.

        Returns:
            ChatSession: The created and refreshed database session object.

        Raises:
            Exception: If the database insertion or commit fails, with an automatic rollback.
        """
        try:
            # Step 1: Instantiate ChatSession model with user, title, and linked document
            new_session = ChatSession(user_id=user_id, title=title, document_id=document_id)
            # Step 2: Add new session to database unit of work
            db.add(new_session)
            # Step 3: Commit transaction to generate persistent primary keys
            await db.commit()
            # Step 4: Refresh instance attributes from the database and return
            await db.refresh(new_session)
            return new_session
        except Exception as e:
            # Step 5: Rollback transaction on failure
            await db.rollback()
            print(f"Error in ChatRepository.create_session: {e}")
            raise 

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
            # Step 1: Construct ChatMessage instance with sender role and message text
            new_msg = ChatMessage(session_id=session_id, sender=sender, text=text)
            # Step 2: Add message to database session
            db.add(new_msg)
            # Step 3: Commit message persistence to database
            await db.commit()
            return new_msg
        except Exception as e:
            # Step 4: Rollback transaction on failure
            await db.rollback()
            print(f"Error in ChatRepository.save_message: {e}")
            raise 

    @staticmethod
    async def get_session_messages(db: AsyncSession, session_id: UUID, user_id:UUID):
        """
        Retrieves all messages associated with a specific session, ordered by time.

        Args:
            db (AsyncSession): Database session dependency.
            session_id (UUID): The unique identifier of the chat session.
            user_id (UUID): The unique identifier of the user

        Returns:
            List[ChatMessage]: A list of message objects ordered chronologically.

        Raises:
            Exception: If the retrieval query fails.
        """
        try:
            # Step 1: Build select query joining ChatSession to enforce user ownership
            query = select(ChatMessage).join(ChatSession).where(ChatMessage.session_id == session_id, ChatSession.user_id == user_id).order_by(ChatMessage.timestamp.asc())
            # Step 2: Execute query asynchronously
            result = await db.execute(query)
            # Step 3: Extract and return scalar list of chronological messages
            return result.scalars().all()
        except Exception as e:
            print(f"Error in ChatRepository.get_session_messages: {e}")
            raise 
    
    @staticmethod
    async def get_session_by_id(db: AsyncSession, user_id: UUID, session_id: UUID):
        """Retrieves a single ChatSession by its ID and user ID."""
        try:
            # Step 1: Build select query filtering by session ID and owner user ID
            query = select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
            # Step 2: Execute query and retrieve single record or None
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            print(f"Error in ChatRepository.get_session_by_id: {e}")
            raise

    @staticmethod
    async def update_session_document(db: AsyncSession,user_id:UUID, session_id: UUID, document_id: UUID):
        """
        Performs an update operation to link a document to an existing chat session.

        Args:
            db (AsyncSession): Database session dependency.4
            user_id (UUID): The unique identifier of the user
            session_id (UUID): The identifier of the session to update.
            document_id (UUID): The identifier of the document to link.

        Returns:
            bool: True if the update operation was successful.

        Raises:
            Exception: If the update fails, with an automatic rollback.
        """
        try:
            # Step 1: Build update statement linking document_id to session
            query = (
                update(ChatSession)
                .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
                .values(document_id=document_id)
            )
            # Step 2: Execute update statement
            await db.execute(query)
            # Step 3: Commit transaction to database
            await db.commit()
            return True
        except Exception as e:
            # Step 4: Rollback transaction on failure
            print(f"Error in ChatRepository.update_session_document: {e}")
            await db.rollback()
            raise 
        
    @staticmethod
    async def get_all_sessions(user_id:UUID,db: AsyncSession):
        """
        Queries all chat sessions with their related messages and document metadata.

        Uses eager loading (selectinload) to efficiently retrieve nested relationships 
        for the history view, sorted by creation date (newest first).

        Args:
            user_id (UUID): The unique identifier of the user
            db (AsyncSession): Database session dependency.

        Returns:
            List[ChatSession]: A list of all session objects with relationships loaded.

        Raises:
            Exception: If the complex join/retrieval query fails.
        """
        try:
            # Step 1: Build query with selectinload for nested messages and linked document
            query = (
                select(ChatSession)
                .options(
                    selectinload(ChatSession.messages),
                    selectinload(ChatSession.document)
                ).where(ChatSession.user_id == user_id)
                .order_by(ChatSession.created_at.desc()) 
            )
            # Step 2: Execute query and extract all scalar session records
            result = await db.execute(query)
            sessions = result.scalars().all()
            return sessions
        except Exception as e:
            print(f"Error in ChatRepository.get_all_sessions: {e}")
            raise 
    
    @staticmethod
    async def rename_session(db: AsyncSession,user_id:UUID, session_id: UUID, new_title: str):
        """
        Updates the title field for a specific ChatSession record.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            session_id (UUID): The unique identifier of the session to rename.
            new_title (str): The new string to set as the session title.

        Returns:
            bool: True if the commit was successful.

        Raises:
            Exception: If the title update fails, with an automatic rollback.
        """
        try:
            # Step 1: Build update query setting the new session title
            query = (
                update(ChatSession)
                .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
                .values(title=new_title)
            )
            # Step 2: Execute query and commit update
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            # Step 3: Rollback on failure
            await db.rollback()
            print(f"Error in ChatRepository.rename_session: {e}")
            raise 

    @staticmethod
    async def delete_sessions(db: AsyncSession, user_id:UUID, session_ids: list[UUID]):
        """
        Removes multiple ChatSession records based on a provided list of IDs.

        Args:
            db (AsyncSession): Database session dependency.
            user_id (UUID): The unique identifier of the user
            session_ids (List[UUID]): A list of UUIDs representing the sessions to delete.

        Returns:
            bool: True if the deletion and commit were successful.

        Raises:
            Exception: If the batch deletion fails, with an automatic rollback.
        """
        try:
            # Step 1: Construct delete statement targeting given IDs belonging to the authenticated user
            query = (
                delete(ChatSession)
                .where(ChatSession.id.in_(session_ids), ChatSession.user_id == user_id)
            )
            # Step 2: Execute bulk delete and commit changes
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            # Step 3: Rollback on failure
            await db.rollback()
            print(f"Error in ChatRepository.delete_sessions: {e}")
            raise
