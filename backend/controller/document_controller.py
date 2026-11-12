import logging
from uuid import UUID

from dotenv import load_dotenv
from dto.document_dto import (
    DocumentBatchDeleteResponseDTO,
    DocumentCreate,
    DocumentRenameRequest,
    DocumentResponse,
)
from dto.error_dto import (
    BadRequestErrorDTO,
    InternalServerErrorDTO,
    NotFoundErrorDTO,
    UnauthorizedErrorDTO,
)
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from repository.database import get_async_session
from services.document_service import DocumentService
from sqlalchemy.ext.asyncio import AsyncSession
from utils.jwt_utils import get_current_user
from utils.rate_limiter import RateLimiter

load_dotenv()
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=201,
    summary="Upload Document",
    description="Uploads a PDF or text document and queues asynchronous in-memory OCR extraction and embedding vectorization.",
    responses={
        201: {"model": DocumentResponse, "description": "Document uploaded and background processing queued."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid file format or page count exceeds 50 pages."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid Supabase bearer token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error during document upload."},
    },
)
async def upload_document(background_tasks: BackgroundTasks,user_id:UUID = Depends(RateLimiter(limit=7, window_seconds=60, scope="upload_doc")), file: DocumentCreate = Body(...), db: AsyncSession = Depends(get_async_session)):  # noqa: B008
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
        # Step 1: Delegate document record creation and background OCR/embedding task to DocumentService
        return await DocumentService.upload_file(db, user_id, file, background_tasks)
    except HTTPException as e:
        # Step 2a: Log and re-raise structured HTTP exceptions
        logger.error(f"HTTP Exception in upload document session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 2b: Catch unexpected system errors and return an HTTP 500 error
        logger.error(f"Exception occured in upload document session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch(
    "/{doc_id}/rename",
    response_model=DocumentResponse,
    summary="Rename Document",
    description="Updates the display name of an existing document owned by the authenticated user.",
    responses={
        200: {"model": DocumentResponse, "description": "Document renamed successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Document not found or invalid name."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        404: {"model": NotFoundErrorDTO, "description": "Document not found for this user."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error while renaming document."},
    },
)
async def rename_document(doc_id: UUID, request: DocumentRenameRequest,user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="doc_rename")), db: AsyncSession = Depends(get_async_session)):  # noqa: B008
    """
    Updates the display name of an existing document.

    Args:
        doc_id (UUID): The unique identifier of the document to rename.
        request (DocumentRenameRequest): DTO containing the document name to be changed
        user_id (UUID): The unique identifier of the user
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentResponse: The updated document metadata.

    """
    try:
        # Step 1: Delegate rename operation to DocumentService (updates DB and updates cache)
        updated_doc = await DocumentService.rename_file(db, user_id, doc_id, request.new_name)
        # Step 2: Validate that the document exists and belongs to the user
        if not updated_doc:
            raise HTTPException(status_code=400, detail="Document not found")
        # Step 3: Return the updated document response DTO
        return updated_doc
    except HTTPException as e:
        # Step 4a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in rename document session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 4b: Handle unexpected system errors
        logger.error(f"Exception occured in rename document session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete(
    "/batch",
    response_model=DocumentBatchDeleteResponseDTO,
    summary="Batch Delete Documents",
    description="Deletes multiple documents, their vector chunks, Supabase storage binaries, and associated cache keys.",
    responses={
        200: {"model": DocumentBatchDeleteResponseDTO, "description": "Documents deleted successfully."},
        400: {"model": BadRequestErrorDTO, "description": "Invalid document IDs provided."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error during document deletion."},
    },
)
async def delete_documents(doc_ids: list[UUID],user_id: UUID = Depends(RateLimiter(limit=60, window_seconds=60, scope="del_doc")), db: AsyncSession = Depends(get_async_session)):  # noqa: B008
    """
    Deletes multiple documents and their associated vector chunks from the system.

    Args:
        doc_ids (List[UUID]): A list of document identifiers to be removed.
        user_id (UUID): The unique identifier of the user.
        db (AsyncSession): Database session dependency.

    Returns:
        DocumentBatchDeleteResponseDTO: A status payload indicating the success of the batch deletion.
    """
    try:
        # Step 1: Execute batch deletion of documents, chunks, and cached entries
        result = await DocumentService.delete_files(db, user_id, doc_ids)
        # Step 2: Return status payload
        if result:
            return DocumentBatchDeleteResponseDTO(status="Success", data=result )
        return DocumentBatchDeleteResponseDTO(status="Failure", data=result)
    except HTTPException as e:
        # Step 3a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in delete documents: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 3b: Handle unexpected system errors
        logger.error(f"Exception occured in delete documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/",
    response_model=list[DocumentResponse],
    summary="Get All Documents",
    description="Retrieves a list of all documents belonging to the authenticated user using Read-Through caching.",
    responses={
        200: {"model": list[DocumentResponse], "description": "List of user documents retrieved successfully."},
        401: {"model": UnauthorizedErrorDTO, "description": "Missing or invalid authentication token."},
        500: {"model": InternalServerErrorDTO, "description": "Internal server error retrieving documents."},
    },
)
async def get_documents(user_id: UUID = Depends(get_current_user), db: AsyncSession = Depends(get_async_session)):  # noqa: B008
    """
    Retrieves a list of all uploaded documents and their metadata.

    Args:
        user_id (UUID): The unique identifier of the user.
        db (AsyncSession): Database session dependency.

    Returns:
        List[DocumentResponse]: A list of document metadata objects.
    """
    try:
        # Step 1: Fetch documents using read-through caching (Redis or PostgreSQL fallback)
        return await DocumentService.fetch_documents(user_id, db)
    except HTTPException as e:
        # Step 2a: Handle known HTTP exceptions
        logger.error(f"HTTP Exception in get documents session: {e}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:  # noqa: BLE001
        # Step 2b: Handle unexpected system errors
        logger.error(f"Exception occured in get documents session: {e}")
        raise HTTPException(status_code=500, detail=str(e))