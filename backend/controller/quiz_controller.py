import logging
from typing import List
from uuid import UUID

from dto.quiz_dto import QuizDeleteResponseDTO, QuizGenerationRequestDTO, QuizGenerationResponseDTO, QuizQuestionRequest, QuizSessionRenameRequest, QuizSessionRenameResponse, QuizSessionResponseDTO, QuizSubmitResponseDTO, SetupQuizRequest
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

@router.post("/setup")
async def setup_quiz(
    title:SetupQuizRequest,
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user),
):
    """Creates the initial shell for the quiz and enforces the 10-quiz limit."""
    try:
        user_id_uuid = UUID(user_id)
        session = await QuizService.initialize_quiz(
            db=db, 
            user_id=user_id_uuid, 
            quiz_title=title
        )

        print("session id:", session)
        return {"session":session}
    
    except HTTPException as e:
        print("Error in controller:",e)
        raise HTTPException(status_code=400, detail=e.detail)

    except Exception as e:
        logger.error(f"Controller Error (setup): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize quiz setup.")

@router.delete("/sessions/bulk-delete", response_model=QuizDeleteResponseDTO)
async def delete_quizes(
    session_ids: List[UUID], 
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """Deletes a quiz, freeing up space against the 10-quiz limit."""
    try:
        response_data = await QuizService.delete_quizes(db, user_id, session_ids)
        return {"message":"success", "session_ids":response_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Controller Error (delete): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete quiz.")
    
@router.patch("/{session_id}/attach/{document_id}")
async def attach_document_to_session(
    session_id: UUID, 
    document_id: UUID, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Links an existing document to an active chat session.

    Args:
        session_id (UUID): The unique identifier of the chat session.
        document_id (UUID): The unique identifier of the document to be attached.
        user_id (UUID): The unique identifier of the user
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary confirming the success of the link operation.
    """
    try:
        print("Session id and doc id:", session_id, document_id)
        await QuizService.update_document(db,user_id, session_id, document_id)

        print("After calling update document repo in service")
        return {"status": "success", "message": "Document linked successfully"}
    except Exception as e:
        print("Exception in attach doc controller", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}/rename", response_model=QuizSessionRenameResponse)
async def rename_quiz_session(
    session_id: UUID, 
    request: QuizSessionRenameRequest, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Updates the title of a specific chat session.

    Args:
        session_id (UUID): The unique identifier of the session to rename.
        request (SessionRenameRequest): DTO containing the new title string.
        user_id (UUID): The unique identifier of the user
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and the updated session data.
    """
    try:
        result = await QuizService.update_quiz_session_title(db,user_id, session_id, request.title)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """The Fork in the Road: Handles both Instant MCQ grading and Async AI Text grading."""
    try:
        updated_session = await QuizService.evaluate_mcq_submission(
                    db=db, 
                    session_id=session_id, 
                    user_submissions=user_answers,
                    user_id=user_id
            )
        response = {
            "message":"Quiz is submitted",
            "status":"Success",
            "score":updated_session.score
        }
        return response
            
    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Controller Error (submit): {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit quiz.")