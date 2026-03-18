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
router = APIRouter(prefix="/documents", tags=["Documents"])
os.environ["GOOGLE_API_KEY"] = os.getenv('EMBEDDING_KEY')

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(background_tasks: BackgroundTasks,user_id: UUID = Depends(get_current_user), file: DocumentCreate = Body(...), 
    db: AsyncSession = Depends(get_async_session)):
    """
    Uploads a PDF document and generates vector embeddings.

    Args:
        file (UploadFile): The PDF file to be uploaded.
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentResponse: The metadata of the newly created document.

    Raises:
        HTTPException: 400 if the file is not a PDF, 500 for internal server errors.
    """
    try:
        if not file.name.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        return await DocumentService.upload_file(db,user_id, file, background_tasks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{doc_id}/rename", response_model=DocumentResponse)
async def rename_document(doc_id: UUID, request: DocumentRenameRequest,user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Updates the display name of an existing document.

    Args:
        doc_id (UUID): The unique identifier of the document to rename.
        request (DocumentRenameRequest): DTO containing the 'new_name' string.
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentResponse: The updated document metadata.

    Raises:
        HTTPException: 400 if the document ID is not found, 500 for internal server errors.
    """
    try:
        updated_doc = await DocumentService.rename_file(db,user_id, doc_id, request.new_name)
        if not updated_doc:
            raise HTTPException(status_code=400, detail="Document not found")
        return updated_doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/batch")
async def delete_documents(doc_ids: List[UUID],user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Deletes multiple documents and their associated vector chunks from the system.

    Args:
        doc_ids (List[UUID]): A list of document identifiers to be removed.
        db (AsyncSession): Database session dependency.

    Returns:
        dict: A status dictionary indicating the success of the batch deletion.
    """
    try:
        success = await DocumentService.delete_files(db,user_id, doc_ids)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentResponse])
async def get_documents(user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):
    """
    Retrieves a list of all uploaded documents and their metadata.

    Args:
        db (AsyncSession): Database session dependency.

    Returns:
        List[DocumentResponse]: A list of document metadata objects.
    """
    try:
        return await DocumentService.fetch_documents(user_id,db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
