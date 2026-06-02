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
    """Creates the initial shell for the quiz and enforces the 10-quiz limit.

    Args:
        title (SetupQuizRequest): DTO containing the initial setup criteria for the quiz.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        dict: A dictionary wrapping the newly created session information.
    """
    try:
        user_id_uuid = UUID(user_id)
        session = await QuizService.initialize_quiz(
            db=db, 
            user_id=user_id_uuid, 
            quiz_title=title
        )

        return {"session":session}
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in setup: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.error(f"Exception occured in setup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/bulk-delete", response_model=QuizDeleteResponseDTO)
async def delete_quizes(
    session_ids: List[UUID], 
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """Deletes a batch of quiz sessions, freeing up space against the 10-quiz limit.

    Args:
        session_ids (List[UUID]): Collection of unique session identifiers to remove.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user

    Returns:
        dict: Confirmation payload containing success status and deleted session IDs.
    """
    try:
        response_data = await QuizService.delete_quizes(db, user_id, session_ids)
        return {"message":"success", "session_ids":response_data}
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in delete quizes: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    
    except Exception as e:
        logger.error(f"Exception occured in delete quiz session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.patch("/{session_id}/attach/{document_id}")
async def attach_document_to_session(
    session_id: UUID, 
    document_id: UUID, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Links an existing document context to an active quiz session.

    Args:
        session_id (UUID): The unique identifier of the target quiz session.
        document_id (UUID): The unique identifier of the document reference to link.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        dict: Confirmation payload indicating execution status.
    """
    try:
        await QuizService.update_document(db,user_id, session_id, document_id)
        return {"status": "success", "message": "Document linked successfully"}

    except HTTPException as e:
        logger.error(f"HTTP Exception in attach document session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.error(f"Exception occured in attach document session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}/rename", response_model=QuizSessionRenameResponse)
async def rename_quiz_session(
    session_id: UUID, 
    request: QuizSessionRenameRequest, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Updates the title of a specific quiz session.

    Args:
        session_id (UUID): The unique identifier of the session to rename.
        request (QuizSessionRenameRequest): DTO containing the new title string.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        dict: A status confirmation with the updated session metadata.
    """
    try:
        result = await QuizService.update_quiz_session_title(db,user_id, session_id, request.title)
        return {"status": "success", "data": result}
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in rename quiz session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
        
    except Exception as e:
        logger.error(f"Exception occured in Rename quiz session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[QuizSessionResponseDTO])
async def get_sidebar_history(
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
):
    """Fetches the lightweight historical list of quiz sessions for the navigation sidebar.

    Args:
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        List[QuizSessionResponseDTO]: List of quiz session history items.
    """
    try:
        quizzes = await QuizService.get_sidebar_history(db=db, user_id=user_id)
        return quizzes
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in get sidebar history: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    
    except Exception as e:
        logger.error(f"Exception occured in getting sidebar history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}", response_model=QuizSessionResponseDTO)
async def poll_quiz_status(
    session_id: UUID, 
    db: AsyncSession = Depends(get_async_session), 
    user_id: UUID = Depends(get_current_user)
):
    """Acts as a polling endpoint to monitor async AI evaluation and generation progress.

    Args:
        session_id (UUID): The unique identifier of the session being evaluated.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (UUID): The unique identifier of the authenticated user.

    Returns:
        QuizSessionResponseDTO: Current metadata, state, and evaluation results of the quiz session.
    """
    try:
        session_data = await QuizService.get_quiz_for_polling(db=db, session_id=session_id, user_id=user_id)
        
        return session_data
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in Poll Quiz Status session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Exception occured in polling quiz status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/generate", response_model=QuizGenerationResponseDTO)
async def generate_quiz(
    session_id: UUID, 
    background_tasks: BackgroundTasks,
    quiz_params:QuizGenerationRequestDTO,
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
):
    """Triggers an asynchronous background process to generate quiz content utilizing AI models.

    Args:
        session_id (UUID): Target quiz session identifier where generated questions will live.
        background_tasks (BackgroundTasks): FastAPI abstraction handler for non-blocking worker execution.
        quiz_params (QuizGenerationRequestDTO): Rules and parameters to guide generation.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        QuizGenerationResponseDTO: Meta configurations detailing generation kickoff state.
    """
    try:
        response_data = await QuizService.trigger_quiz_generation(
            db=db, 
            session_id=session_id, 
            background_tasks=background_tasks,
            user_id=user_id,
            quiz_params = quiz_params
        )
        return response_data
    
    except HTTPException as e:
        logger.error(f"HTTP Exception generate quiz session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.error(f"Exception occured in generate quiz session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/submit", response_model=QuizSubmitResponseDTO)
async def submit_quiz(
    session_id: UUID, 
    user_answers: List[QuizQuestionRequest], 
    db: AsyncSession = Depends(get_async_session), 
    user_id=Depends(get_current_user)
) :
    """Processes completions; scores fixed MCQ submissions instantly or forks to async text workflows.

    Args:
        session_id (UUID): The unique identifier of the evaluated quiz session.
        user_answers (List[QuizQuestionRequest]): Collection of answers submitted by the user.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        dict: Map tracking compilation status, grading confirmation messages, and numeric score.
    """
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
            
    except HTTPException as e:
        logger.error(f"HTTP Exception in Submit quiz session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.error(f"Exception occured in submit quiz: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))