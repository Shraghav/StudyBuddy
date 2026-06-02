import logging
from typing import  List
from uuid import UUID

from pydantic import TypeAdapter

from dto.enums import QuizStatus
from dto.quiz_dto import  QuizGenerationRequestDTO, QuizGenerationResponseDTO, QuizQuestionRequest, QuizSessionActiveDTO, QuizSessionCompletedDTO, QuizSessionMinimalDTO, SetupQuizRequest
from fastapi import BackgroundTasks, HTTPException
from repository.quiz_repository import QuizRepository
from services.quiz_engine.background_tasks import generate_quiz_task
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

class QuizService:

    @staticmethod
    async def initialize_quiz(db: AsyncSession, user_id: UUID, quiz_title:SetupQuizRequest):
        """Initializes a new quiz session shell after verifying the user's active quiz count limit.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            quiz_title (SetupQuizRequest): DTO containing the desired initialization details.

        Returns:
            Any: The repository layer response payload for the created quiz session.
        """
        try:
            current_count = await QuizRepository.get_user_quiz_count(db, user_id)
            if current_count >= 10:
                raise HTTPException(
                    status_code=400, 
                    detail="Limit reached. Please delete an old quiz to create a new one."
                )

            response = await QuizRepository.create_quiz_session(db, user_id, quiz_title.title)

            print("Quiz service response:", response)
            return response

        except HTTPException as e:
            print("Error in service:",e)
            raise  
        except Exception as e:
            logger.error(f"Service Error (initialize_quiz): {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error during initialization.")

    @staticmethod
    async def evaluate_mcq_submission(db: AsyncSession, session_id: UUID, user_submissions: List[QuizQuestionRequest], user_id:UUID):
        """Validates and grades multiple-choice question submissions instantly, updating the session metrics.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the quiz session.
            user_submissions (List[QuizQuestionRequest]): Collection of questions answered by the user.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            Any: The repository layer evaluation results containing structural changes and final score.
        """
        try:
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz not found.")

            if session.status == "completed":
                raise HTTPException(status_code=400, detail="Quiz already submitted.")

            correct_map = {q.id: str(q.correct_answer).strip() for q in session.questions}
            
            evaluated_data = []
            correct_count = 0

            for sub in user_submissions:
                q_id = sub.question_id
                user_ans = str(sub.user_answer or "").strip()
                
                if q_id in correct_map:
                    is_correct = (user_ans.lower() == correct_map[q_id].lower())
                    if is_correct:
                        correct_count += 1

                    evaluated_data.append({
                        "question_id": q_id,
                        "user_answer": user_ans, 
                        "is_correct": is_correct
                    })

            score_to_save = correct_count

            response = await QuizRepository.save_mcq_evaluation(db, session, evaluated_data, score_to_save)
            return response
        
        except HTTPException:
            raise
        
        except Exception as e:
            logger.error(f"Service Error (evaluate_mcq): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to grade MCQ submission.")

    @staticmethod
    async def get_quiz_for_polling(db: AsyncSession, session_id: UUID, user_id: UUID):
        """Fetches structured quiz session data dynamically tailored to the current lifecycle status for system polling.
            Args:
                db (AsyncSession): Asynchronous database session dependency.
                session_id (UUID): The unique identifier of the quiz session.
                user_id (UUID): The unique identifier of the authenticated user.

            Returns:
                Union[QuizSessionMinimalDTO, QuizSessionActiveDTO, QuizSessionCompletedDTO]: The validated status payload mapping current progress.
            """
        try:
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz not found.")

            if session.status not in [QuizStatus.active, QuizStatus.completed]:
                return QuizSessionMinimalDTO.model_validate(session)

            questions_data = []
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

            print("Questions data:", questions_data)
            if session.status == QuizStatus.active:
                return QuizSessionActiveDTO(
                    id=session.id, title=session.title, status=session.status, questions=questions_data
                )
            
            if session.status == QuizStatus.completed:
                return QuizSessionCompletedDTO(
                    id=session.id, title=session.title, status=session.status, 
                    score=session.score, feedback=session.feedback or "", questions=questions_data
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Service Error (polling): {str(e)}")
            raise Exception("Error processing quiz status.")

    @staticmethod
    async def get_sidebar_history(db: AsyncSession, user_id: UUID):
        """Retrieves and validates a structural summary list of all quiz sessions belonging to a specific user.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.

        Returns:
            List[QuizSessionMinimalDTO]: Formatted listing of lightweight historical quiz instances.
        """
        try:
            raw_quizzes = await QuizRepository.get_all_user_quizzes(db, user_id)
            adapter = TypeAdapter(List[QuizSessionMinimalDTO])
            validated_history = adapter.validate_python(raw_quizzes)
            return validated_history
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            logger.error(f"Service Error (sidebar): {str(e)}")
            raise HTTPException(status_code=500, detail="Could not load quiz history.")
    @staticmethod
    async def update_document(db: AsyncSession,user_id:UUID,session_id:UUID, document_id: UUID):
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
            session = await QuizRepository.update_session_document(db,user_id, session_id, document_id)
            return {"Updated document": session}
        except Exception as e:
            print(f"Error in ChatService.create_session: {e}")
            raise e
    
    @staticmethod
    async def delete_quizes(db: AsyncSession, user_id: UUID, session_ids:List[UUID]):
        """Removes a collective batch of quiz sessions from the records to restore available user slots.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_ids (List[UUID]): Array list containing historical identifiers targeted for deletion.

        Returns:
            List[UUID]: List of successfully processed and removed session identifiers.
        """
        try:
            success = await QuizRepository.remove_sessions(db,  user_id, session_ids)
            if not success:
                raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")
            return session_ids
        
        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"Service Error (delete): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to delete quiz.")

    @staticmethod
    async def trigger_quiz_generation(db: AsyncSession, session_id: UUID, background_tasks: BackgroundTasks, user_id:UUID, quiz_params:QuizGenerationRequestDTO):
        """Transitions a target session's state and attaches an asynchronous background task to execute automated generation.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            session_id (UUID): The unique identifier of the active session context.
            background_tasks (BackgroundTasks): Task manager processing non-blocking background threads.
            user_id (UUID): The unique identifier of the authenticated user.
            quiz_params (QuizGenerationRequestDTO): Parametric criteria steering the content generation framework.

        Returns:
            QuizGenerationResponseDTO: Meta initialization response data displaying trigger lifecycle success.
        """
        try:
            session = await QuizRepository.update_quiz_data(db, user_id,session_id, QuizStatus.generating, quiz_params )
            if not session:
                raise HTTPException(status_code=404, detail="Session not found.")
            
            background_tasks.add_task(generate_quiz_task, session_id, user_id)

            quiz_generation_response = QuizGenerationResponseDTO(
                message="Started generation",
                session_title=session.title
            )
            return quiz_generation_response

        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"Service Error (trigger_gen): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to start generation.")

    @staticmethod
    async def update_quiz_session_title(db: AsyncSession,user_id:UUID, session_id: UUID, new_title: str):
        """Updates the operational display string title identifying a designated quiz session.
        Args:
            db (AsyncSession): Asynchronous database session dependency.
            user_id (UUID): The unique identifier of the authenticated user.
            session_id (UUID): The unique identifier of the active quiz session.
            new_title (str): String value specifying the updated name allocation.

        Returns:
            dict: Structured configuration payload message validating rename success.
        """
        try:
            await QuizRepository.rename_session(db,user_id, session_id, new_title)
            return {"message": "Session renamed successfully"}
        except Exception as e:
            print(f"Error in ChatService.update_session_title: {e}")
            raise e