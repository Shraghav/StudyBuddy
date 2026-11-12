import logging
from typing import Any
from uuid import UUID

from dto.enums import QuizStatus
from dto.quiz_dto import (
    QuizGenerationRequestDTO,
    QuizGenerationResponseDTO,
    QuizQuestionRequest,
    QuizSessionActiveDTO,
    QuizSessionCompletedDTO,
    QuizSessionMinimalDTO,
    SetupQuizRequest,
)
from fastapi import BackgroundTasks, HTTPException
from pydantic import TypeAdapter
from repository.quiz_repository import QuizRepository
from services.quiz_engine.background_tasks import generate_quiz_task
from sqlalchemy.ext.asyncio import AsyncSession
from utils.caching.cache_manager import CacheManager

logger = logging.getLogger(__name__)


class QuizService:
    @staticmethod
    async def initialize_quiz(db: AsyncSession, user_id: UUID, quiz_request: SetupQuizRequest):
        """Initializes a new quiz session shell after verifying the user's active quiz count limit.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            quiz_request (SetupQuizRequest): DTO containing the desired initialization details.

        Returns:
            Any: The repository layer response payload for the created quiz session.
        """
        try:
            # Step 1: Enforce active quiz count limit (max 10 active quizzes per user)
            current_count = await QuizRepository.get_user_quiz_count(db, user_id)
            if current_count >= 10:
                raise HTTPException(
                    status_code=400,
                    detail="Limit reached. Please delete an old quiz to create a new one.",
                )
            # Step 2: Create initial quiz session shell in database
            response = await QuizRepository.create_quiz_session(db, user_id, quiz_request.title, quiz_request.document_id)
            status_val = getattr(response, "status", QuizStatus.setup)
            status_str = status_val.value if hasattr(status_val, "value") else str(status_val)
            # Step 3: Write-through cache new quiz session to Redis sidebar
            await CacheManager.add_user_quiz_session(
                user_id=user_id,
                quiz_dict={
                    "session_id": str(response.id),
                    "title": response.title,
                    "status": status_str,
                },
            )
            # Step 4: Return newly initialized session
            return response
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (initialize_quiz): %s", e)
            raise HTTPException(status_code=500, detail="Internal server error during initialization.") from e

    @staticmethod
    async def evaluate_mcq_submission(
        db: AsyncSession, session_id: UUID, user_submissions: list[QuizQuestionRequest], user_id: UUID
    ):
        """Validates and grades multiple-choice question submissions instantly, updating the session metrics.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the quiz session.
            user_submissions (list[QuizQuestionRequest]): Collection of questions answered by the user.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            Any: The repository layer evaluation results containing structural changes and final score.
        """
        try:
            # Step 1: Fetch quiz session and validate state
            session:Any = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            print("session:", session.questions)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz not found.")
            # if session.status == "completed":
            #     raise HTTPException(status_code=400, detail="Quiz already submitted.")

            # Step 2: Build map of question IDs to normalized correct answers
            correct_map = {q.id: str(q.correct_answer).strip() for q in session.questions}
            evaluated_data = []
            correct_count = 0
            print("correct map:", correct_map)
            # Step 3: Compare submitted answers against correct answers and tally score
            for sub in user_submissions:
                q_id = sub.question_id
                print("qid:", q_id)
                user_ans = str(sub.user_answer or "").strip()
                print("user ans:", user_ans)
                if q_id in correct_map:
                    is_correct = user_ans.lower() == correct_map[q_id].lower()
                    if is_correct:
                        correct_count += 1
                    evaluated_data.append({
                        "question_id": q_id,
                        "user_answer": user_ans,
                        "is_correct": is_correct,
                    })
            score_to_save = correct_count

            # Step 4: Save evaluations and final score in database
            response = await QuizRepository.save_mcq_evaluation(db, session, evaluated_data, score_to_save)
            return response
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (evaluate_mcq): %s", e)
            raise HTTPException(status_code=500, detail="Failed to grade MCQ submission.") from e

    @staticmethod
    async def get_quiz_for_polling(
        db: AsyncSession, session_id: UUID, user_id: UUID
    ) -> Any:
        """Fetches structured quiz session data dynamically tailored to the current lifecycle status for system polling.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the quiz session.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            Union[QuizSessionMinimalDTO, QuizSessionActiveDTO, QuizSessionCompletedDTO]: The validated status payload mapping current progress.
        """
        try:
            # Step 1: Fetch session record from database
            session: Any = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz not found.")

            # Step 2: Return minimal summary if quiz is in setup or generating phase
            if session.status not in [QuizStatus.active, QuizStatus.completed]:
                return QuizSessionMinimalDTO.model_validate(session)

            # Step 3: Format question list for active or completed states
            questions_data = []
            print("Session:", session.questions)
            for q in session.questions:
                q_dict = {
                    "id": q.id,
                    "text": q.text,
                    "options": q.options,
                    "user_answer": q.user_answer,
                    "correct_answer": q.correct_answer,
                    "evaluation_score": q.evaluation_score,
                }
                questions_data.append(q_dict)

            # Step 4: Return corresponding state DTO
            if session.status == QuizStatus.active:
                return QuizSessionActiveDTO(
                    session_id=session.id,
                    title=session.title,
                    status=session.status,
                    questions=questions_data,
                )
            if session.status == QuizStatus.completed:
                return QuizSessionCompletedDTO(
                    session_id=session.id,
                    title=session.title,
                    status=session.status,
                    score=session.score,
                    feedback=session.feedback or "",
                    questions=questions_data,
                )
            return QuizSessionMinimalDTO.model_validate(session)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (polling): %s", e)
            raise HTTPException(status_code=500, detail="Error processing quiz status.") from e

    @staticmethod
    async def get_sidebar_history(db: AsyncSession, user_id: UUID) -> list[QuizSessionMinimalDTO]:
        """Retrieves and validates a structural summary list of all quiz sessions using Read-Through caching."""
        try:
            # Step 1: Check Redis cache for sidebar history
            cache_key = CacheManager.user_quiz_sidebar_key(user_id)
            cached = await CacheManager.get_json(cache_key)
            print("Cached data in sidebar history:", cached)
            adapter = TypeAdapter(list[QuizSessionMinimalDTO])
            if cached is not None:
                return adapter.validate_python(cached)

            # Step 2: Query database on cache miss and validate with TypeAdapter
            raw_quizzes = await QuizRepository.get_all_user_quizzes(db, user_id)
            print("Raw quizes:", raw_quizzes)
            validated_history = adapter.validate_python(raw_quizzes)

            # Step 3: Write-through cache to Redis and return list
            await CacheManager.set_json(cache_key, [q.model_dump(mode="json") for q in validated_history])
            return validated_history
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (sidebar): %s", e)
            raise HTTPException(status_code=500, detail="Could not load quiz history.") from e

    @staticmethod
    async def update_document(db: AsyncSession, user_id: UUID, session_id: UUID, document_id: UUID):
        """Updates and associates an explicit source document reference link to a designated quiz session.

        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_id (UUID): The unique identifier of the quiz session.
            document_id (UUID): The unique identifier of the document to link.

        Returns:
            dict: Structured lookup dictionary indicating updated configuration confirmations.
        """
        try:
            # Step 1: Link document to quiz session in database
            return await QuizRepository.update_session_document(db, user_id, session_id, document_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in QuizService.update_document: %s", e)
            raise

    @staticmethod
    async def delete_quizes(db: AsyncSession, user_id: UUID, session_ids: list[UUID]) -> list[UUID]:
        """Removes a collective batch of quiz sessions from the records to restore available user slots."""
        try:
            # Step 1: Delete quiz sessions from database
            success = await QuizRepository.remove_sessions(db, user_id, session_ids)
            if not success:
                raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")
            # Step 2: Remove deleted quiz sessions from Redis cache
            await CacheManager.remove_user_quiz_sessions(user_id, session_ids)
            return session_ids
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (delete): %s", e)
            raise HTTPException(status_code=500, detail="Failed to delete quiz.") from e

    @staticmethod
    async def trigger_quiz_generation(
        db: AsyncSession,
        session_id: UUID,
        background_tasks: BackgroundTasks,
        user_id: UUID,
        quiz_params: QuizGenerationRequestDTO,
    ) -> QuizGenerationResponseDTO:
        """Transitions a target session's state and attaches an asynchronous background task to execute automated generation."""
        try:
            # Step 1: Transition session status to 'generating' and store quiz parameters in DB
            session: Any = await QuizRepository.update_quiz_data(
                db, user_id, session_id, QuizStatus.generating, quiz_params
            )
            if not session:
                raise HTTPException(status_code=404, detail="Session not found.")
            # Step 2: Enqueue async generate_quiz_task in FastAPI BackgroundTasks
            background_tasks.add_task(generate_quiz_task, session_id, user_id)
            # Step 3: Return immediate response indicating generation kickoff
            quiz_generation_response = QuizGenerationResponseDTO(
                message="Started generation", session_title=session.title
            )
            return quiz_generation_response
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Service Error (trigger_gen): %s", e)
            raise HTTPException(status_code=500, detail="Failed to start generation.") from e

    @staticmethod
    async def update_quiz_session_title(db: AsyncSession, user_id: UUID, session_id: UUID, new_title: str):
        """Updates the operational display string title identifying a designated quiz session."""
        try:
            # Step 1: Update session title in database
            await QuizRepository.rename_session(db, user_id, session_id, new_title)
            # Step 2: Invalidate sidebar cache
            await CacheManager.invalidate_user_quiz_sidebar(user_id)
            return {"message": "Session renamed successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in QuizService.update_quiz_session_title: %s", e)
            raise