import logging
from typing import Any
from uuid import UUID

from dto.enums import QuizStatus
from dto.quiz_dto import QuizGenerationRequestDTO
from repository.models import Document, QuizQuestion, QuizSession
from sqlalchemy import delete, func, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm.attributes import set_committed_value

logger = logging.getLogger(__name__)


class QuizRepository:
    @staticmethod
    async def create_quiz_session(db: AsyncSession, user_id: UUID, title: str, document_id: UUID | None = None) -> Any:
        """Creates the initial shell for a quiz session with an attached document.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the user.
            title (str): The title of the quiz session.
            document_id (UUID | None): The unique identifier of the linked document.

        Returns:
            Any: The newly created quiz session object model instance.
        """
        try:
            # Step 1: Instantiate QuizSession model with initial setup state
            new_session = QuizSession(
                user_id=user_id,
                title=title,
                document_id=document_id,
                questions=[],
            )
            # Step 2: Add session to DB unit of work and commit transaction
            db.add(new_session)
            await db.commit()
            return new_session

        except SQLAlchemyError as e:
            await db.rollback()
            logger.error("Database error in create_quiz_session: %s", e)
            raise

        except Exception as e:
            await db.rollback()
            logger.error("Unexpected error in create_quiz_session: %s", e)
            raise

    @staticmethod
    async def get_user_quiz_count(db: AsyncSession, user_id: UUID) -> int:
        """Counts how many active quizzes a user has to enforce the 10-quiz limit.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the target user.

        Returns:
            int: The aggregate total of existing quiz sessions.
        """
        try:
            # Step 1: Execute aggregate COUNT query filtering by user_id
            stmt = select(func.count(QuizSession.id)).where(QuizSession.user_id == user_id)
            result = await db.execute(stmt)
            count = result.scalar()
            # Step 2: Return integer total
            return count or 0

        except Exception as e:
            logger.error("Error fetching quiz count for user %s: %s", user_id, e)
            raise

    @staticmethod
    async def get_quiz_session_by_id(db: AsyncSession, session_id: UUID, user_id: UUID) -> Any:
        """Fetches a specific quiz session and eagerly loads all associated questions.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the specific quiz session.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            Any: The quiz session database record if found, otherwise None.
        """
        try:
            # Step 1: Query QuizSession by session_id and user_id
            stmt = select(QuizSession).where(
                QuizSession.id == session_id,
                QuizSession.user_id == user_id,
            )
            result = await db.execute(stmt)
            session: Any = result.scalar_one_or_none()

            # Step 2: Return None if session does not exist
            if not session:
                return None
            # Step 3: Refresh and populate question entities for active/completed quizzes
            if session.status in [QuizStatus.active, QuizStatus.completed, QuizStatus.grading]:
                await db.refresh(session, attribute_names=["questions"])
            else:
                set_committed_value(session, "questions", [])

            return session

        except Exception as e:
            logger.error("Error fetching quiz session %s: %s", session_id, e)
            raise

    @staticmethod
    async def get_all_user_quizzes(db: AsyncSession, user_id: UUID) -> list[Any]:
        """Fetches lightweight quiz session tracking history for the sidebar display.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            list[Any]: A list of summarized quiz records containing tracking fields.
        """
        try:
            # Step 1: Select lightweight summary columns (id, title, status) for sidebar
            stmt = select(QuizSession.id, QuizSession.title, QuizSession.status).where(
                QuizSession.user_id == user_id
            )
            # Step 2: Execute query and extract mapping records
            result = await db.execute(stmt)
            return list(result.mappings().all())

        except Exception as e:
            logger.error("Error fetching all quizzes for user %s: %s", user_id, e)
            raise

    @staticmethod
    async def get_document_data(db: AsyncSession, document_id: UUID) -> Any:
        """Fetches data associated with a specific document identifier.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            document_id (UUID): The unique identifier of the target document.

        Returns:
            Any: The database reference model or None.
        """
        try:
            # Step 1: Query Document record by document_id
            stmt = select(Document).where(Document.id == document_id)
            result = await db.execute(stmt)
            # Step 2: Return matched document or None
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error("Error fetching Document url %s", e)
            raise

    @staticmethod
    async def update_session_document(
        db: AsyncSession, user_id: UUID, session_id: UUID, document_id: UUID
    ) -> bool:
        """Performs an update operation to link a document to an existing quiz session.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_id (UUID): The unique identifier of the targeted quiz session.
            document_id (UUID): The unique identifier of the document to link.

        Returns:
            bool: True if the update transaction execution was successful.
        """
        try:
            # Step 1: Build update statement linking document_id to session
            query = (
                update(QuizSession)
                .where(QuizSession.id == session_id, QuizSession.user_id == user_id)
                .values(document_id=document_id)
            )
            # Step 2: Execute statement and commit transaction
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            logger.error("Error in QuizRepository.update_session_document: %s", e)
            await db.rollback()
            raise

    @staticmethod
    async def rename_session(db: AsyncSession, user_id: UUID, session_id: UUID, new_title: str) -> bool:
        """Updates the title field name for a specific quiz session record.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_id (UUID): The unique identifier of the quiz session to modify.
            new_title (str): The new text string to apply as the session title.

        Returns:
            bool: True if the update and database commit were successful.
        """
        try:
            # Step 1: Build update statement setting new session title
            query = (
                update(QuizSession)
                .where(QuizSession.id == session_id, QuizSession.user_id == user_id)
                .values(title=new_title)
            )
            # Step 2: Execute query and commit transaction
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error("Error in QuizRepository.rename_session: %s", e)
            raise

    @staticmethod
    async def update_quiz_data(
        db: AsyncSession,
        user_id: UUID,
        session_id: UUID,
        status: QuizStatus,
        quiz_params: QuizGenerationRequestDTO | None = None,
    ) -> Any:
        """Updates the workflow status and optional generation parameters for a quiz session.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_id (UUID): The unique identifier of the targeted quiz session.
            status (QuizStatus): The next phase state value to apply to the session.
            quiz_params (QuizGenerationRequestDTO | None): Optional configuration DTO settings.

        Returns:
            Any: The repository layer response payload containing the modified record data.
        """
        try:
            # Step 1: Assemble status and serialized setup_params payload
            update_data: dict[str, Any] = {"status": status}

            if quiz_params is not None:
                update_data["setup_params"] = quiz_params.model_dump()
            # Step 2: Execute update query returning updated session entity
            query = (
                update(QuizSession)
                .where(QuizSession.id == session_id, QuizSession.user_id == user_id)
                .values(update_data)
                .returning(QuizSession)
            )
            result = await db.execute(query)
            updated_session = result.scalars().first()
            # Step 3: Commit database transaction
            await db.commit()
            return updated_session
        except Exception as e:
            await db.rollback()
            logger.error("Error in QuizRepository.update_quiz_data: %s", e)
            raise

    @staticmethod
    async def save_generated_questions(
        db: AsyncSession,
        session_id: UUID,
        questions_data: list[dict[str, Any]],
        user_id: UUID,
    ) -> Any:
        """Saves AI-generated questions into the database and marks the session active.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the targeted quiz session.
            questions_data (list[dict[str, Any]]): Structured parameters representing questions.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            Any: The active quiz session entity containing new questions.
        """
        try:
            # Step 1: Look up session ensuring user ownership
            session: Any = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                return None

            # Step 2: Convert questions_data dictionaries to QuizQuestion models
            questions_to_add = []
            for q in questions_data:
                new_q = QuizQuestion(
                    quiz_session_id=session_id,
                    text=q["text"],
                    options=q.get("options"),
                    correct_answer=q["correct_answer"],
                )
                questions_to_add.append(new_q)

            # Step 3: Add question batch and transition status to active
            db.add_all(questions_to_add)
            session.status = "active"

            # Step 4: Commit changes and refresh instance
            await db.commit()
            await db.refresh(session)
            return session

        except Exception as e:
            await db.rollback()
            logger.error("Error saving generated questions for %s: %s", session_id, e)
            raise

    @staticmethod
    async def save_mcq_evaluation(
        db: AsyncSession,
        session: Any,
        evaluated_answers: list[dict[str, Any]],
        total_score: int,
    ) -> Any:
        """Saves calculated multiple choice question evaluations and grading scores.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session (Any): The current quiz session entity undergoing evaluation.
            evaluated_answers (list[dict[str, Any]]): Collection of evaluated answers.
            total_score (int): The absolute evaluation score total awarded to the user.

        Returns:
            Any: The updated quiz session containing persistent score metrics.
        """
        try:
            # Step 1: Assign total score and transition status to completed
            session.score = total_score
            session.status = "completed"

            # Step 2: Build lookup map for user answer evaluations
            eval_map = {str(ans["question_id"]): ans for ans in evaluated_answers}

            # Step 3: Iterate through session questions and assign user answers and scores
            for question in session.questions:
                q: Any = question
                qid_str = str(q.id)
                if qid_str in eval_map:
                    ans_data = eval_map[qid_str]
                    q.user_answer = ans_data["user_answer"]
                    q.evaluation_score = 1.0 if ans_data["is_correct"] else 0.0
            # Step 4: Save session, commit transaction, and refresh
            db.add(session)
            await db.commit()
            await db.refresh(session)
            return session

        except Exception as e:
            await db.rollback()
            logger.error("Error saving MCQ evaluation: %s", e)
            raise

    @staticmethod
    async def remove_sessions(db: AsyncSession, user_id: UUID, session_ids: list[UUID]) -> bool:
        """Enables session capacity management by executing batch deletions.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_ids (list[UUID]): Collection of unique database identifiers to remove.

        Returns:
            bool: True if the bulk removal transaction executed successfully.
        """
        try:
            # Step 1: Execute bulk delete matching session IDs for user
            query = delete(QuizSession).where(
                QuizSession.id.in_(session_ids), QuizSession.user_id == user_id
            )
            print("Query:", query)
            # Step 2: Commit transaction
            await db.execute(query)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            logger.error("Error deleting session: %s", e)
            raise
