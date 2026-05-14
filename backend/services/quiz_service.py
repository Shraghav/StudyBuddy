import logging
from typing import  List
from uuid import UUID

from dto.enums import QuizStatus
from dto.quiz_dto import  QuizGenerationRequestDTO, QuizGenerationResponseDTO, QuizQuestionRequest, QuizSessionActiveDTO, QuizSessionCompletedDTO, QuizSessionMinimalDTO
from fastapi import BackgroundTasks, HTTPException
from repository.quiz_repository import QuizRepository
from services.quiz_engine.background_tasks import (generate_quiz_task,
                                                   grade_text_quiz_task)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

class QuizService:

    @staticmethod
    async def initialize_quiz(db: AsyncSession, user_id: UUID):
        try:
            current_count = await QuizRepository.get_user_quiz_count(db, user_id)
            if current_count >= 10:
                raise HTTPException(
                    status_code=400, 
                    detail="Limit reached. Please delete an old quiz to create a new one."
                )
            title = f"Quiz {current_count}"
            response = await QuizRepository.create_quiz_session(db, user_id, title)
            return {"message":"Quiz is initialized successfully", "session_id":response.id}

        except HTTPException:
            raise  
        except Exception as e:
            logger.error(f"Service Error (initialize_quiz): {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error during initialization.")

    @staticmethod
    async def evaluate_mcq_submission(db: AsyncSession, session_id: UUID, user_submissions: List[QuizQuestionRequest], user_id:UUID):
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

            total_q = len(session.questions)
            score_percentage = int((correct_count / total_q) * 100) if total_q > 0 else 0

            await QuizRepository.save_mcq_evaluation(db, session, evaluated_data, score_percentage)
            return {"message": "Answers submitted. AI is grading your responses.", "status": "grading"}
        
        except HTTPException:
            raise
        
        except Exception as e:
            logger.error(f"Service Error (evaluate_mcq): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to grade MCQ submission.")

    @staticmethod
    async def get_quiz_for_polling(db: AsyncSession, session_id: UUID, user_id: UUID):
        try:
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz not found.")

            if session.status not in [QuizStatus.active, QuizStatus.completed]:
                return QuizSessionMinimalDTO.model_validate(session)

            is_mcq = session.setup_params.get("format") == "mcq" if session.setup_params else False

            print("Is mcq:", is_mcq)
            questions_data = []
            for q in session.questions:
                q_dict = {
                    "id": q.id, 
                    "text": q.text, 
                    "options": q.options if is_mcq else None,
                    "user_answer": q.user_answer, 
                    "correct_answer": q.correct_answer,
                    "evaluation_score": q.evaluation_score, 
                    "evaluation_feedback": q.evaluation_feedback
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
        try:
            return await QuizRepository.get_all_user_quizzes(db, user_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Service Error (sidebar): {str(e)}")
            raise HTTPException(status_code=500, detail="Could not load quiz history.")

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
            session = await QuizRepository.update_session_document(db,user_id, session_id, document_id)
            return {"Updated document": session}
        except Exception as e:
            print(f"Error in ChatService.create_session: {e}")
            raise e
    
    @staticmethod
    async def delete_quiz(db: AsyncSession, session_id: UUID, user_id: UUID):
        try:
            success = await QuizRepository.delete_quiz_session(db, session_id, user_id)
            if not success:
                raise HTTPException(status_code=404, detail="Quiz not found or unauthorized.")
            
            return {"message":"Quiz deleted successfully", "session_id":session_id}
        
        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"Service Error (delete): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to delete quiz.")

    @staticmethod
    async def trigger_quiz_generation(db: AsyncSession, session_id: UUID, background_tasks: BackgroundTasks, user_id:UUID, quiz_params:QuizGenerationRequestDTO):
        """
        The 'Ignition' for Module 3. 
        Flips status to 'generating' and starts the Grok background worker.
        """
        try:
            session = await QuizRepository.update_quiz_data(db, session_id,user_id,QuizStatus.generating, quiz_params )
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
            await QuizRepository.rename_session(db,user_id, session_id, new_title)
            return {"message": "Session renamed successfully"}
        except Exception as e:
            print(f"Error in ChatService.update_session_title: {e}")
            raise e

    @staticmethod
    async def submit_text_quiz(db: AsyncSession, session_id: UUID, user_submissions: List[QuizQuestionRequest], background_tasks: BackgroundTasks, user_id:UUID):
        """
        Handles Text submissions. 
        Saves raw answers and triggers the AI Grader background task.
        """
        try:
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                raise HTTPException(status_code=404, detail="Quiz session not found.")
            
            if session.status == "completed":
                raise HTTPException(status_code=400, detail="Quiz already submitted.")
            if session.status == "grading":
                raise HTTPException(status_code=400, detail="Previous quiz is being graded.")

            await QuizRepository.save_raw_text_answers(db, session_id, user_submissions, user_id)
            
            await QuizRepository.update_quiz_data(db, session_id, user_id, QuizStatus.grading)
            background_tasks.add_task(grade_text_quiz_task, session_id, user_submissions, user_id)

            return {"message": "Answers submitted. AI is grading your responses.", "status": "grading"}

        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"Service Error (submit_text): {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to submit text answers.")