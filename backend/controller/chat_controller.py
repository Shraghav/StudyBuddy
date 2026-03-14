from uuid import UUID

from utils.jwt_utils import get_current_user
from dto.chat_dto import (BulkDeleteRequest, ChatRequest, SessionCreate,
                          SessionRenameRequest)
from fastapi import APIRouter, Depends, HTTPException
from repository.database import get_async_session
from services.chat_service import ChatService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/{session_id}/{document_id}")
async def chat_with_document(
    session_id: UUID, 
    document_id: UUID, 
    request: ChatRequest, 
    db: AsyncSession = Depends(get_async_session)
):
    """
    Processes a user question within a specific session using a linked document's context.

    Args:
        session_id (UUID): The unique identifier of the chat session.
        document_id (UUID): The unique identifier of the document to query.
        request (ChatRequest): DTO containing the user's question.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and the AI-generated content response.
    """
    try:
        ans = await ChatService.ask_question(db, session_id, document_id, request.question)
        return {"status":"success", "content":ans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
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
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary confirming the success of the link operation.
    """
    try:
        await ChatService.update_document(db,user_id, session_id, document_id)
        return {"status": "success", "message": "Document linked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/sessions/{session_id}/rename")
async def rename_chat_session(
    session_id: UUID, 
    request: SessionRenameRequest, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Updates the title of a specific chat session.

    Args:
        session_id (UUID): The unique identifier of the session to rename.
        request (SessionRenameRequest): DTO containing the new title string.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and the updated session data.
    """
    try:
        result = await ChatService.update_session_title(db,user_id, session_id, request.title)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
async def create_new_session(
    request: SessionCreate, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Creates a new chat session for a user.  

    Args:
        request (SessionCreate): DTO containing session title and optional document_id.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and the newly created session object.
    """
    try:
        session = await ChatService.invoke_create_session(
            db=db, 
            user_id=user_id, 
            title=request.title,
            document_id=request.document_id
        )
        return  {"status":"success", "session":session}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions/bulk-delete")
async def delete_chat_sessions(
    request: BulkDeleteRequest, 
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Deletes multiple chat sessions in a single request.

    Args:
        request (BulkDeleteRequest): DTO containing a list of session_ids to delete.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and result of the deletion process.
    """
    try:   
        result = await ChatService.remove_sessions(db, user_id, request.session_ids)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/all")
async def fetch_history(user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Retrieves the complete chat session history for the current user. Current user is null for now

    Args:
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A dictionary containing the status and a list of all chat sessions.
    """
    try:
        history = await ChatService.get_full_history(user_id, db)
        print("User id in controller", user_id)
        return {"status": "success", "sessions": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))