import logging
from uuid import UUID

from dto.error_dto import (
    BadRequestErrorDTO,
    InternalServerErrorDTO,
    NotFoundErrorDTO,
    UnauthorizedErrorDTO,
)
from dto.quiz_dto import (
    QuizDeleteResponseDTO,
    QuizGenerationRequestDTO,
    QuizGenerationResponseDTO,
    QuizQuestionRequest,
    QuizSessionMinimalDTO,
    QuizSessionRenameRequest,
    QuizSessionRenameResponse,
    QuizSessionResponseDTO,
    QuizSetupResponseDTO,
    QuizSubmitResponseDTO,
    SetupQuizRequest,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from repository.database import get_async_session
from services.quiz_service import QuizService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.jwt_utils import get_current_user
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/quiz",
    tags=["Quiz Module"]
)

@router.post(
    "/sessions",
    response_model=QuizSetupResponseDTO,
    status_code=201,
    summary="Setup Quiz Session",
    description="Initializes a new quiz session shell linked to a document and enforces the 10-quiz maximum quota.",
    responses={
        201: {"model": QuizSetupResponseDTO, "description": "Quiz session initialized successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Active quiz limit reached (maximum 10)."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error during quiz setup."},
    },
)
async def setup_quiz(
    request: SetupQuizRequest, db: AsyncSession = Depends(get_async_session),user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="quiz_setup")),  # noqa: B008
):
    """Creates the initial shell for the quiz and enforces the 10-quiz limit.

    Args:
        request (SetupQuizRequest): DTO containing the title and doc id
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        QuizSetupResponseDTO: A typed model wrapping the newly created session information.
    """
    try:
        # Step 1: Normalize user_id to UUID format
        user_id_uuid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
        # Step 2: Initialize quiz shell in DB and enforce the 10-quiz limit
        session = await QuizService.initialize_quiz(
            db=db, 
            user_id=user_id_uuid, 
            quiz_request=request
        )
        # Step 3: Return confirmation payload with new session details
        return QuizSetupResponseDTO(status="success", session=session)
    except HTTPException as e:
        # Step 4a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in setup: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 4b: Handle unexpected system errors
        logger.error(f"Exception occured in setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete(
    "/sessions/bulk-delete",
    response_model=QuizDeleteResponseDTO,
    summary="Bulk Delete Quiz Sessions",
    description="Deletes multiple quiz sessions and their associated questions, freeing up space against the 10-quiz limit.",
    responses={
        200: {"model": QuizDeleteResponseDTO, "description": "Quiz sessions deleted successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid quiz session IDs."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        404: {"model": NotFoundErrorDTO, "description": "Quiz sessions not found or unauthorized."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error during deletion."},
    },
)
async def delete_quizes(
    session_ids: list[UUID], 
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
    user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="quiz_delete"))  # noqa: B008
) :
    """Deletes a batch of quiz sessions, freeing up space against the 10-quiz limit.

    Args:
        session_ids (List[UUID]): Collection of unique session identifiers to remove.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user

    Returns:
        QuizDeleteResponseDTO: Confirmation payload containing success status and deleted session IDs.
    """
    try:
        # Step 1: Perform bulk deletion of quiz sessions and associated questions in QuizService
        response_data = await QuizService.delete_quizes(db, user_id, session_ids)
        # Step 2: Return list of successfully removed session IDs
        return QuizDeleteResponseDTO(message="success", session_ids=response_data)
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in delete quizes: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in delete quiz session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.patch(
    "/sessions/{session_id}/rename",
    response_model=QuizSessionRenameResponse,
    summary="Rename Quiz Session",
    description="Updates the title of a specific quiz session.",
    responses={
        200: {"model": QuizSessionRenameResponse, "description": "Quiz session renamed successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid title parameter."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        404: {"model": NotFoundErrorDTO, "description": "Quiz session not found."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error during rename."},
    },
)
async def rename_quiz_session(
    session_id: UUID, request: QuizSessionRenameRequest, user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="quiz_rename")), db: AsyncSession = Depends(get_async_session)  # noqa: B008
):
    """Updates the title of a specific quiz session.

    Args:
        session_id (UUID): The unique identifier of the session to rename.
        request (QuizSessionRenameRequest): DTO containing the new title string.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        QuizSessionRenameResponse: A status confirmation with the updated session metadata.
    """
    try:
        # Step 1: Update the quiz session title in DB and write-through cache
        result = await QuizService.update_quiz_session_title(db, user_id, session_id, request.title)
        # Step 2: Return updated session information
        return QuizSessionRenameResponse(status="success", data=result)
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in rename quiz session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in Rename quiz session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/",
    response_model=list[QuizSessionMinimalDTO],
    summary="Get Sidebar Quiz History",
    description="Retrieves a lightweight summary of all quiz sessions for the authenticated user for sidebar rendering.",
    responses={
        200: {"model": list[QuizSessionMinimalDTO], "description": "List of user quiz sessions retrieved successfully."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error loading sidebar history."},
    },
)
async def get_sidebar_history(
    db: AsyncSession = Depends(get_async_session), user_id=Depends(get_current_user)  # noqa: B008
):
    """Fetches the lightweight historical list of quiz sessions for the navigation sidebar.

    Args:
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        List[QuizSessionMinimalDTO]: List of quiz session history items.
    """
    try:
        # Step 1: Query QuizService for user's quiz sessions (checking cache first)
        quizzes = await QuizService.get_sidebar_history(db=db, user_id=user_id)
        # Step 2: Return list of quiz metadata
        return quizzes
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in get sidebar history: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in getting sidebar history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/{session_id}",
    response_model=QuizSessionResponseDTO,
    summary="Poll Quiz Session Status",
    description="Polls the current lifecycle state, generated questions, and grading evaluation metrics for a quiz session.",
    responses={
        200: {"model": QuizSessionResponseDTO, "description": "Current quiz status and question payload."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        404: {"model": NotFoundErrorDTO, "description": "Quiz session not found."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error polling quiz status."},
    },
)
async def poll_quiz_status(
    session_id: UUID, db: AsyncSession = Depends(get_async_session), user_id: UUID = Depends(get_current_user)  # noqa: B008
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
        # Step 1: Poll current status and question payloads from QuizService
        session_data = await QuizService.get_quiz_for_polling(db=db, session_id=session_id, user_id=user_id)
        # Step 2: Return quiz session state DTO
        return session_data
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in Poll Quiz Status session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in polling quiz status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/{session_id}/generate",
    response_model=QuizGenerationResponseDTO,
    status_code=202,
    summary="Trigger Quiz Question Generation",
    description="Dispatches a background worker to extract document content (via OCR or cache) and generate MCQs via ChatGroq.",
    responses={
        202: {"model": QuizGenerationResponseDTO, "description": "Background question generation job accepted and started."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid generation parameters or prompt."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        404: {"model": NotFoundErrorDTO, "description": "Quiz session not found."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error triggering generation."},
    },
)
async def generate_quiz(
    session_id: UUID, 
    background_tasks: BackgroundTasks,
    quiz_params:QuizGenerationRequestDTO,
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
    user_id: UUID = Depends(RateLimiter(limit=20, window_seconds=60, scope="generate_quiz"))  # noqa: B008
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
        # Step 1: Enqueue async AI question generation task via BackgroundTasks
        response_data = await QuizService.trigger_quiz_generation(
            db=db, 
            session_id=session_id, 
            background_tasks=background_tasks,
            user_id=user_id,
            quiz_params = quiz_params
        )
        # Step 2: Return immediate response indicating generation has been queued
        return response_data
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception generate quiz session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in generate quiz session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/{session_id}/submit",
    response_model=QuizSubmitResponseDTO,
    summary="Submit Quiz Answers",
    description="Submits user answers for instant automated grading and score calculation against ground truth answers.",
    responses={
        200: {"model": QuizSubmitResponseDTO, "description": "Quiz evaluated and scored successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Quiz already submitted or invalid answers."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication credentials."},
        404: {"model": NotFoundErrorDTO, "description": "Quiz session not found."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error evaluating submission."},
    },
)
async def submit_quiz(
    session_id: UUID, 
    user_answers: list[QuizQuestionRequest], 
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
    user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="submit_quiz"))  # noqa: B008
) :
    """Processes completions; scores fixed MCQ submissions instantly or forks to async text workflows.

    Args:
        session_id (UUID): The unique identifier of the evaluated quiz session.
        user_answers (List[QuizQuestionRequest]): Collection of answers submitted by the user.
        db (AsyncSession): Asynchronous database session dependency.
        user_id (Any): The unique identifier of the authenticated user.

    Returns:
        QuizSubmitResponseDTO: Map tracking compilation status, grading confirmation messages, and numeric score.
    """
    try:
        # Step 1: Grade user answer submissions against correct options stored in the database
        updated_session = await QuizService.evaluate_mcq_submission(
                    db=db, 
                    session_id=session_id, 
                    user_submissions=user_answers,
                    user_id=user_id
            )
        # Step 2: Build submission confirmation response with calculated score
        response = QuizSubmitResponseDTO(
            message="Quiz is submitted",
            status="Success",
            score=updated_session.score
        )
        # Step 3: Return grading summary to caller
        return response      
    except HTTPException as e:
        # Step 4a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in Submit quiz session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 4b: Handle unexpected system errors
        logger.error(f"Exception occured in submit quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))