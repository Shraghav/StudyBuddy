import logging
from uuid import UUID

from dto.chat_dto import ChatRequest, SessionCreate, SessionRenameRequest
from fastapi import APIRouter, Depends, HTTPException
from repository.database import get_async_session
from services.chat_service import ChatService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.jwt_utils import get_current_user
from utils.rate_limiter import RateLimiter

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

@router.post("/{session_id}/message")
async def chat_with_session(
    session_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(RateLimiter(limit=20, window_seconds=60)),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Processes a user question within a specific session using its linked document context.
    Uses a SINGLE path parameter (session_id). The document is resolved automatically
    from the session record in the database. Rate-limited to 20 requests/minute.
    """
    try:
        response = await ChatService.ask_question(
            db=db, session_id=session_id, question=request.question, user_id=user_id
        )
        return response
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Exception in chat_with_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}/rename")
async def rename_chat_session(
    session_id: UUID,
    request: SessionRenameRequest,
    user_id: UUID = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Updates the title of a specific chat session."""
    try:
        result = await ChatService.update_session_title(db, user_id, session_id, request.title)
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Exception in rename_chat_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
async def create_new_session(
    request: SessionCreate,
    user_id: UUID = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Creates a new chat session for a user."""
    try:
        session = await ChatService.invoke_create_session(
            db=db,
            user_id=user_id,
            title=request.title,
            document_id=request.document_id,
        )
        return {"status": "success", "session": session}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Exception in create_new_session: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/bulk-delete")
async def delete_chat_sessions(
    session_ids: list[UUID],
    user_id: UUID = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_async_session),  # noqa: B008
):
    """Deletes multiple chat sessions in a single request."""
    try:
        result = await ChatService.remove_sessions(db, user_id, session_ids)
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Exception in delete_chat_sessions: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/all")
async def fetch_history(
    user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)  # noqa: B008
):
    """Retrieves the complete chat session history for the current user."""
    try:
        history = await ChatService.get_full_history(user_id, db)
        return {"status": "success", "sessions": history}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error("Exception in fetch_history: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# Legacy endpoints
# @router.post("/{session_id}/{document_id}", include_in_schema=False)
# async def chat_with_document_legacy(
#     session_id: UUID,
#     document_id: UUID,
#     request: ChatRequest,
#     user_id: UUID = Depends(RateLimiter(limit=20, window_seconds=60)),  # noqa: B008
#     db: AsyncSession = Depends(get_async_session),  # noqa: B008
# ):
#     """Legacy backward-compatible endpoint accepting redundant document_id in path."""
#     try:
#         response = await ChatService.ask_question(
#             db=db,
#             session_id=session_id,
#             question=request.question,
#             document_id=document_id,
#             user_id=user_id,
#         )
#         return response
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error("Exception in chat_with_document_legacy: %s", e)
#         raise HTTPException(status_code=500, detail=str(e))


