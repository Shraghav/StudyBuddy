import logging
from uuid import UUID

from dto.chat_dto import (
    ChatBulkDeleteResponseDTO,
    ChatHistoryResponseDTO,
    ChatRequest,
    ChatSessionCreateResponseDTO,
    ChatSessionRenameResponseDTO,
    SessionCreate,
    SessionRenameRequest,
)
from dto.error_dto import (
    BadRequestErrorDTO,
    InternalServerErrorDTO,
    NotFoundErrorDTO,
    RateLimitErrorDTO,
    UnauthorizedErrorDTO,
)
from fastapi import APIRouter, Depends, HTTPException
from repository.database import get_async_session
from services.chat_service import ChatService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.rate_limiter import RateLimiter

from backend.utils.jwt_utils import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

@router.post(
    "/{session_id}/message",
    summary="Chat Message Streaming",
    description="Streams an AI response grounded in the attached document via Server-Sent Events (SSE) with NotebookLM-style citations. Rate-limited to 20 requests per minute.",
    responses={
        200: {
            "description": "Server-Sent Events (SSE) stream delivering token chunks, citation events, and terminal [DONE] signal.",
            "content": {
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "example": 'data: "Database "\n\ndata: "management "\n\ndata: {"event": "citations", "sources": [{"id": 1, "page": 3, "snippet": "..."}]}\n\ndata: "[DONE]"\n\n'
                    }
                }
            },
        },
        400: {"model": BadRequestErrorDTO, "description": "No document linked to this chat session."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        404: {"model": NotFoundErrorDTO, "description": "Chat session not found."},
        429: {"model": RateLimitErrorDTO, "description": "Rate limit exceeded (maximum 20 requests per minute)."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error generating chat response."},
    },
)
async def chat_with_session(
    session_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(RateLimiter(limit=20, window_seconds=60, scope="ai_chat")),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Processes a user question within a specific session using its linked document context.

    Uses a SINGLE path parameter (session_id). The document is resolved automatically
    from the session record in the database. Rate-limited to 20 requests/minute.

    Args:
        session_id (UUID): The unique identifier of the chat session.
        request (ChatRequest): DTO containing the user's question.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        StreamingResponse: Server-Sent Events stream delivering token chunks and citation metadata.
    """
    try:
        # Step 1: Forward the user query, session ID, and user ID to ChatService for RAG processing
        response = await ChatService.ask_question(
            db=db, session_id=session_id, question=request.question, user_id=user_id
        )
        # Step 2: Return the streaming SSE response containing generated answer chunks and citations
        return response
    except HTTPException:
        # Step 3a: Re-raise known HTTP exceptions without altering status code
        raise
    except Exception as e:  # noqa: BLE001
        # Step 3b: Log unexpected errors and return an HTTP 500 error response
        logger.error("Exception in chat_with_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch(
    "/sessions/{session_id}/rename",
    response_model=ChatSessionRenameResponseDTO,
    summary="Rename Chat Session",
    description="Updates the display title of a specific chat session and updates the cache.",
    responses={
        200: {"model": ChatSessionRenameResponseDTO, "description": "Chat session renamed successfully."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        404: {"model": NotFoundErrorDTO, "description": "Chat session not found."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error renaming session."},
    },
)
async def rename_chat_session(
    session_id: UUID,
    request: SessionRenameRequest,
    user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="chat_write")),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Updates the title of a specific chat session.

    Args:
        session_id (UUID): The unique identifier of the chat session to rename.
        request (SessionRenameRequest): DTO containing the new title.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        ChatSessionRenameResponseDTO: A typed response containing operation status and updated session data.
    """
    try:
        # Step 1: Call ChatService to update the session title in the database and invalidate cache
        result = await ChatService.update_session_title(db, user_id, session_id, request.title)
        # Step 2: Return standardized success payload with updated session data
        return ChatSessionRenameResponseDTO(status="success", data=result)
    except HTTPException:
        # Step 3a: Re-raise known HTTP exceptions
        raise
    except Exception as e:  # noqa: BLE001
        # Step 3b: Log and return HTTP 500 on unexpected errors
        logger.error("Exception in rename_chat_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/sessions",
    response_model=ChatSessionCreateResponseDTO,
    status_code=201,
    summary="Create Chat Session",
    description="Creates a new chat session linked to an uploaded document and caches the session metadata in Redis.",
    responses={
        201: {"model": ChatSessionCreateResponseDTO, "description": "Chat session created successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid document ID or parameters."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error creating chat session."},
    },
)
async def create_new_session(
    request: SessionCreate,
    user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="chat_create")),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Creates a new chat session for a user.

    Args:
        request (SessionCreate): DTO containing the session title and optional document_id.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        ChatSessionCreateResponseDTO: A typed model wrapping the newly created session information.
    """
    try:
        # Step 1: Create the session entity with title and optional document attachment
        session = await ChatService.invoke_create_session(
            db=db,
            user_id=user_id,
            title=request.title,
            document_id=request.document_id,
        )
        # Step 2: Return formatted creation response
        return ChatSessionCreateResponseDTO(status="success", session=session)
    except HTTPException:
        # Step 3a: Re-raise known HTTP exceptions
        raise
    except Exception as e:  # noqa: BLE001
        # Step 3b: Log unexpected errors and return an HTTP 500 error response
        logger.error("Exception in create_new_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete(
    "/sessions/bulk-delete",
    response_model=ChatBulkDeleteResponseDTO,
    summary="Bulk Delete Chat Sessions",
    description="Deletes multiple chat sessions and evicts them from the user's cached history.",
    responses={
        200: {"model": ChatBulkDeleteResponseDTO, "description": "Chat sessions deleted successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid session IDs provided."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error deleting sessions."},
    },
)
async def delete_chat_sessions(
    session_ids: list[UUID],
    user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="chat_delete")),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Deletes multiple chat sessions in a single request.

    Args:
        session_ids (list[UUID]): List of chat session UUIDs to delete.
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        ChatBulkDeleteResponseDTO: A typed payload containing operation status and deletion result.
    """
    try:
        # Step 1: Remove sessions from database and invalidate corresponding Redis keys
        result = await ChatService.remove_sessions(db, user_id, session_ids)
        # Step 2: Return confirmation payload
        return ChatBulkDeleteResponseDTO(status="success", data=result)
    except HTTPException:
        # Step 3a: Re-raise known HTTP exceptions
        raise
    except Exception as e:  # noqa: BLE001
        # Step 3b: Log unexpected errors and return an HTTP 500 error response
        logger.error("Exception in delete_chat_sessions: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/sessions/all",
    response_model=ChatHistoryResponseDTO,
    summary="Get Chat History",
    description="Retrieves the complete chat session history including nested messages and document attachments using Read-Through caching.",
    responses={
        200: {"model": ChatHistoryResponseDTO, "description": "User chat history retrieved successfully."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error fetching chat history."},
    },
)
async def fetch_history(
    user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)  # noqa: B008
):
    """Retrieves the complete chat session history for the current user.

    Args:
        user_id (UUID): The unique identifier of the authenticated user.
        db (AsyncSession): Asynchronous database session dependency.

    Returns:
        ChatHistoryResponseDTO: A typed payload containing the operation status and list of chat sessions.
    """
    try:
        # Step 1: Fetch session history via read-through cache (Redis with DB fallback)
        history = await ChatService.get_full_history(user_id, db)
        # Step 2: Return user's session list
        return ChatHistoryResponseDTO(status="success", sessions=history)
    except HTTPException:
        # Step 3a: Re-raise known HTTP exceptions
        raise
    except Exception as e:  # noqa: BLE001
        # Step 3b: Log unexpected errors and return an HTTP 500 error response
        logger.error("Exception in fetch_history: %s", e)
        raise HTTPException(status_code=500, detail=str(e))