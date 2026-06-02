import logging
import os
from typing import List
from uuid import UUID

from dotenv import load_dotenv
from dto.document_dto import (DocumentCreate, DocumentRenameRequest,
                              DocumentResponse)
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from repository.database import get_async_session
from services.document_service import DocumentService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.jwt_utils import get_current_user

load_dotenv()
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(background_tasks: BackgroundTasks,user_id: UUID = Depends(get_current_user), file: DocumentCreate = Body(...), 
    db: AsyncSession = Depends(get_async_session)):
    """
    Uploads a PDF document and generates vector embeddings.

    Args:
        background_tasks (BackgroundTasks): Used to streamline the AI response by offloading heavy embedding task
        user_id (UUID): The unique identifier of the user
        file (DocumentCreate): The PDF data to be uploaded.
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentResponse: The metadata of the newly created document.
    """
    try:
        return await DocumentService.upload_file(db,user_id, file, background_tasks)
    
    except HTTPException as e:
        logger.error(f"HTTP Exception in upload document session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    except Exception as e:
        logger.error(f"Exception occured in upload document session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{doc_id}/rename", response_model=DocumentResponse)
async def rename_document(doc_id: UUID, request: DocumentRenameRequest,user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Updates the display name of an existing document.

    Args:
        doc_id (UUID): The unique identifier of the document to rename.
        request (DocumentRenameRequest): DTO containing the 'new_name' string.
        user_id (UUID): The unique identifier of the user
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentResponse: The updated document metadata.

    """
    try:
        updated_doc = await DocumentService.rename_file(db,user_id, doc_id, request.new_name)
        if not updated_doc:
            raise HTTPException(status_code=400, detail="Document not found")
        return updated_doc
    except HTTPException as e:
        logger.error(f"HTTP Exception in rename document session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Exception occured in rename document session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/batch")
async def delete_documents(doc_ids: List[UUID],user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Deletes multiple documents and their associated vector chunks from the system.

    Args:
        doc_ids (List[UUID]): A list of document identifiers to be removed.
        user_id (UUID): The unique identifier of the user.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A status dictionary indicating the success of the batch deletion.
    """
    try:
        success = await DocumentService.delete_files(db,user_id, doc_ids)
        return {"success": success}
    except HTTPException as e:
        logger.error(f"HTTP Exception in delete documents: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Exception occured in delete documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentResponse])
async def get_documents(user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Retrieves a list of all uploaded documents and their metadata.

    Args:
        user_id (UUID): The unique identifier of the user.
        db (AsyncSession): Database session dependency.

    Returns:
        List[DocumentResponse]: A list of document metadata objects.
    """
    try:
        return await DocumentService.fetch_documents(user_id,db)
    except HTTPException as e:
        logger.error(f"HTTP Exception in get documents session: {str(e)}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error(f"Exception occured in get documents session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
