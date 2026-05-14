import logging
from typing import List
from uuid import UUID

from dto.quiz_dto import QuizGenerationRequestDTO, QuizGenerationResponseDTO, QuizQuestionRequest, QuizSessionResponseDTO,QuizSetUPAndDeleteResponseDTO, QuizSubmitResponseDTO
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from repository.database import get_async_session
from services.quiz_service import QuizService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.jwt_utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/quiz",
    tags=["Quiz Module"]
)

@router.post("/setup", response_model=QuizSetUPAndDeleteResponseDTO)
async def setup_quiz(
    doc_id: UUID, 
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
):
    """Creates the initial shell for the quiz and enforces the 10-quiz limit."""
    try:
        session = await QuizService.initialize_quiz(
            db=db, 
            user_id=user_id, 
            doc_id = doc_id
        )

        return session
    
    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Controller Error (setup): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize quiz setup.")

@router.get("/", response_model=List[QuizSessionResponseDTO])
async def get_sidebar_history(
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
):
    """Fetches the lightweight history list for the React Native sidebar."""
    try:
        quizzes = await QuizService.get_sidebar_history(db=db, user_id=user_id)
        return quizzes
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Controller Error (sidebar): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load quiz history.")

@router.get("/{session_id}", response_model=QuizSessionResponseDTO)
async def poll_quiz_status(
    session_id: UUID, 
    db: AsyncSession = Depends(get_async_session), 
    user_id: UUID = Depends(get_current_user)
):
    """The Polling Endpoint: React Native calls this every 3 seconds to check on AI progress."""
    try:
        session_data = await QuizService.get_quiz_for_polling(db=db, session_id=session_id, user_id=user_id)
        
        return session_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Controller Error (polling): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch quiz status.")

@router.post("/{session_id}/generate", response_model=QuizGenerationResponseDTO)
async def generate_quiz(
    session_id: UUID, 
    background_tasks: BackgroundTasks,
    quiz_params:QuizGenerationRequestDTO,
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
):
    """The Module 3 Ignition: Starts the Grok AI generation in the background."""
    try:
        response_data = await QuizService.trigger_quiz_generation(
            db=db, 
            session_id=session_id, 
            background_tasks=background_tasks,
            user_id=user_id,
            quiz_params = quiz_params
        )
        return response_data
    
    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Controller Error (generate): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to trigger AI generation.")

@router.post("/{session_id}/submit", response_model=QuizSubmitResponseDTO)
async def submit_quiz(
    session_id: UUID, 
    user_answers: List[QuizQuestionRequest], 
    format:str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """The Fork in the Road: Handles both Instant MCQ grading and Async AI Text grading."""
    try:
        if format.lower() == "mcq":
            updated_session = await QuizService.evaluate_mcq_submission(
                    db=db, 
                    session_id=session_id, 
                    user_submissions=user_answers,
                    user_id=user_id
                )
            return updated_session
            
        elif format.lower() == "text":
            response_data = await QuizService.submit_text_quiz(
                db=db, 
                session_id=session_id, 
                user_submissions=user_answers, 
                background_tasks=background_tasks,
                user_id=user_id
            )
            return response_data
            

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Controller Error (submit): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit quiz.")

@router.delete("/{session_id}", response_model=QuizSetUPAndDeleteResponseDTO)
async def delete_quiz(
    session_id: UUID, 
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """Deletes a quiz, freeing up space against the 10-quiz limit."""
    try:
        response_data = await QuizService.delete_quiz(db=db, session_id=session_id, user_id=user_id)
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Controller Error (delete): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete quiz.")