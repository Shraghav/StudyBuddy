import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from dto.enums import QuizStatus
from dto.quiz_dto import QuizGenerationRequestDTO, QuizQuestionRequest, QuizSessionCompletedDTO
from repository.models import Document, QuizQuestion, QuizSession
from sqlalchemy import delete, func, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value
logger = logging.getLogger(__name__)

class QuizRepository:
    @staticmethod
    async def create_quiz_session(db:AsyncSession, user_id: UUID, title: str, doc_id: UUID) -> QuizSession:
        """Creates the initial shell for a quiz session."""
        try:
            new_session = QuizSession(
            user_id=user_id,     
            title=title, 
            document_id=doc_id,
            questions = []
        )
            db.add(new_session)
            await db.commit()
            return new_session
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error in create_quiz_session: {str(e)}")
            raise e
        
        except Exception as e:
            await db.rollback()
            logger.error(f"Unexpected error in create_quiz_session: {str(e)}")
            raise e
        
    @staticmethod
    async def get_user_quiz_count(db:AsyncSession, user_id: UUID) -> int:
        """Counts how many active quizzes a user has to enforce the 10-quiz limit."""
        try:
            stmt = select(func.count(QuizSession.id)).where(QuizSession.user_id == user_id)
            result = await db.execute(stmt)
            count = result.scalar()
            return count or 0
            
        except Exception as e:
            logger.error(f"Error fetching quiz count for user {user_id}: {str(e)}")
            raise e

    @staticmethod
    async def get_quiz_session_by_id(db:AsyncSession, session_id: UUID, user_id:UUID) -> Optional[QuizSession]:
        """Fetches a specific quiz AND eagerly loads all its associated questions."""
        try:
            stmt = select(QuizSession).where(
                QuizSession.id == session_id, 
                QuizSession.user_id == user_id
            )
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()
            
            if not session:
                return None
            if session.status in [QuizStatus.active, QuizStatus.completed, QuizStatus.grading]:
                await db.refresh(session, attribute_names=['questions'])
            else:
                set_committed_value(session, 'questions', [])
                
            return session
            
        except Exception as e:
            logger.error(f"Error fetching quiz session {session_id}: {str(e)}")
            raise e

    @staticmethod
    async def get_all_user_quizzes(db:AsyncSession, user_id: UUID) -> List[QuizSession]:
        """Fetches lightweight history for the sidebar (No questions loaded here to save memory)."""
        try:
            stmt = select(QuizSession.id, QuizSession.title, QuizSession.status).where(
                QuizSession.user_id == user_id
            )
            
            result = await db.execute(stmt)
            return result.mappings().all()
            
        except Exception as e:
            logger.error(f"Error fetching all quizzes for user {user_id}: {str(e)}")
            raise e
    
    @staticmethod
    async def get_document_data(db:AsyncSession, document_id:UUID) -> List[QuizSession]:
        """Fetches Document data from db"""
        try:
           stmt = select(Document).where(Document.id == document_id)
           result = await db.execute(stmt)
           return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Error fetching Document url {str(e)}")
            raise e

    @staticmethod
    async def update_quiz_data(db:AsyncSession, session_id: UUID, user_id:UUID, status: Optional[QuizStatus] = None, quiz_params: Optional[QuizGenerationRequestDTO] = None) -> Optional[QuizSession]:
        """Quick utility to flip the status of a quiz."""
        try:
            session = await QuizRepository.get_quiz_session_by_id(db,session_id, user_id)
            if not session:
                return None
                
            if status is not None:
                session.status = status

            if quiz_params is not None:
                quiz_params_dict = quiz_params.model_dump()
                session.setup_params = quiz_params_dict
            await db.commit()
            await db.refresh(session)
            return session
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating the data for session {session_id}: {str(e)}")
            raise e

    @staticmethod
    async def save_generated_questions(
        db:AsyncSession, 
        session_id: UUID, 
        questions_data: List[Dict[str, Any]],
        user_id:UUID
    ) -> Optional[QuizSession]:
        """
        Save the AI-generated questions into the QuizQuestion table 
        and flip session status to 'active'.
        """
        try:
            session = await QuizRepository.get_quiz_session_by_id(db,session_id, user_id)
            if not session:
                return None

            questions_to_add = []
            for q in questions_data:
                new_q = QuizQuestion(
                    quiz_session_id=session_id,
                    text=q['text'],
                    options=q.get('options'), 
                    correct_answer=q['correct_answer']
                )
                questions_to_add.append(new_q)

            db.add_all(questions_to_add)
            session.status = "active" 
            
            await db.commit()
            await db.refresh(session)
            return session
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error saving generated questions for {session_id}: {str(e)}")
            raise 

    @staticmethod   
    async def save_mcq_evaluation(
        db:AsyncSession, 
        session: QuizSession, 
        evaluated_answers: List[Dict[str, Any]], 
        total_score: int,
    ) -> QuizSession:
        """
        Saves the instant MCQ grades. 
        evaluated_answers expects a list of dicts: 
        [{"question_id": UUID, "user_answer": str, "is_correct": bool}]
        """
        try:
            session.score = total_score
            session.status = "completed"

            eval_map = {str(ans["question_id"]): ans for ans in evaluated_answers}

            for question in session.questions:
                qid_str = str(question.id)
                if qid_str in eval_map:
                    ans_data = eval_map[qid_str]
                    question.user_answer = ans_data["user_answer"]
                    question.evaluation_score = 100.0 if ans_data["is_correct"] else 0.0
            db.add(session)
            await db.commit()
            await db.refresh(session)
            return session
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error saving MCQ evaluation{str(e)}")
            raise e

    @staticmethod
    async def save_text_evaluation(
        db: AsyncSession, 
        session_id: UUID, 
        evaluations: List[Dict[str, Any]], 
        total_score: int,
        user_id:UUID
    ) -> Optional[QuizSession]:
        """Saves AI-generated scores and feedback for text-based answers."""
        try:
            stmt = select(QuizSession).where(QuizSession.id == session_id).options(
                selectinload(QuizSession.questions)
            )
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()
            if not session:
                return None
            session.score = total_score
            session.status = "completed"
            eval_map = {UUID(e["question_id"]) if isinstance(e["question_id"], str) else e["question_id"]: e 
                        for e in evaluations}
            for question in session.questions:
                if question.id in eval_map:
                    data = eval_map[question.id]
                    question.evaluation_score = float(data.get("score", 0.0))
                    question.evaluation_feedback = data.get("feedback", "No feedback provided.")
            await db.commit()

            await db.refresh(session, attribute_names=['questions'])
            return session
        
        except Exception as e:
            await db.rollback()
            logger.error(f"Repo Error (save_text_evaluation): {str(e)}")
            raise e
        
    @staticmethod    
    async def delete_quiz_session(db:AsyncSession, session_id: UUID, user_id: UUID) -> bool:
        """Enables the 10-quiz limit management by allowing users to delete sessions."""
        try:
            stmt = delete(QuizSession).where(
                QuizSession.id == session_id, 
                QuizSession.user_id == user_id
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting session {session_id}: {str(e)}")
            raise e
        
    @staticmethod
    async def save_raw_text_answers(db: AsyncSession, session_id: UUID, user_submissions: List[QuizQuestionRequest], user_id: UUID):
        """Persists the user's text strings before AI grading begins."""
        try:
            for sub in user_submissions:
                q_id = sub.question_id
                stmt = (
                    update(QuizQuestion)
                    .where(QuizQuestion.quiz_session_id == session_id)
                    .where(QuizQuestion.id == q_id)
                    .values(user_answer=sub.user_answer)
                )
                await db.execute(stmt)
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise e