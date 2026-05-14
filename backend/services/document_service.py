import hashlib
import os
import uuid
from urllib.parse import unquote
from uuid import UUID

import httpx
from dto.document_dto import DocumentCreate
from fastapi import BackgroundTasks
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from repository.database import async_session_maker
from repository.document_repository import DocumentRepository
from repository.models import DocumentChunk
from sqlalchemy.ext.asyncio import AsyncSession
from utils.supabase_utils import supabase

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DocumentService:
    @staticmethod
    async def upload_file(db: AsyncSession, user_id: UUID, file: DocumentCreate, background_tasks: BackgroundTasks):
        """
        Entry point for the non-blocking PDF upload pipeline.

        Workflow:
            1. Idempotency Check: Ensures the same file URL isn't processed twice for the same user.
            2. Record Initialization: Creates a 'Document' entry in the DB to provide immediate UI feedback.
            3. Task Delegation: Triggers the background processing worker via FastAPI BackgroundTasks.
            4. Instant Return: Returns the document metadata to the client to prevent API timeouts.

        Args:
            db (AsyncSession): The primary database session from the request dependency.
            user_id (UUID): The unique identifier of the user uploading the file.
            file (DocumentCreate): DTO containing the file name, Supabase URL, and size.
            background_tasks (BackgroundTasks): FastAPI utility to fire-and-forget the embedding task.

        Returns:
            Document: The initial database record with status set to 'PROCESSING'.

        Raises:
            Exception: If the initial database insertion or idempotency check fails.
        """
        try:
            existing_doc = await DocumentRepository.get_document_by_url(db, user_id, file.file_url)
            if existing_doc:
                return existing_doc

            new_doc = await DocumentRepository.create_document(
                db=db, user_id=user_id, name=file.name, size=file.size, file_url=file.file_url
            )

            background_tasks.add_task(
                DocumentService._process_pdf_background, 
                doc_id=new_doc.id, 
                file_url=file.file_url, 
                file_name=file.name
            )

            return new_doc

        except Exception as e:
            print(f"Error in main thread upload_file: {e}")
            raise e

    @staticmethod
    async def _process_pdf_background(doc_id: UUID, file_url: str, file_name: str):
        """
        Background worker responsible for the resource-intensive RAG processing.

        Workflow:
            1. Resource Acquisition: Opens a fresh AsyncSession specifically for background work.
            2. Retrieval: Downloads the PDF binary from Supabase Storage.
            3. Parsing & Chunking: Extracts text and splits it into manageable overlapping segments.
            4. Batch Embedding: Generates vectors for all chunks in a single optimized API call to Gemini.
            5. Bulk Persistence: Saves all chunks to the database in one transaction for maximum speed.
            6. Finalization: Updates the document status to 'READY' (or 'FAILED' on error).

        Args:
            doc_id (UUID): The ID of the previously created placeholder document.
            file_url (str): The public URL of the PDF in Supabase Storage.
            file_name (str): The original name of the file (used for temporary local storage naming).

        """
        unique_filename = f"{uuid.uuid4()}_{file_name}"
        temp_file_location = f"{UPLOAD_DIR}/{unique_filename}"
        async with async_session_maker() as bg_db: 
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(file_url)
                    response.raise_for_status()
                    with open(temp_file_location, "wb") as f:
                        f.write(response.content)

                loader = PyPDFLoader(temp_file_location)
                docs = loader.load()
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                splits = text_splitter.split_documents(docs)

                embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
                cleaned_texts = [chunk.page_content.replace("\x00", "") for chunk in splits]
                
                vectors = embeddings_model.embed_documents(cleaned_texts)

                new_chunks = []
                for i, clean_text in enumerate(cleaned_texts):
                    content_hash = hashlib.md5(clean_text.encode('utf-8')).hexdigest()
                    
                    new_chunks.append(
                        DocumentChunk(
                            document_id=doc_id,
                            text_content=clean_text,
                            content_hash=content_hash,
                            embedding=vectors[i]
                        )
                    )

                await DocumentRepository.bulk_create_chunks(bg_db, new_chunks)
                await DocumentRepository.update_document_status(bg_db, doc_id, "READY")

            except Exception as e:
                print(f"Background Processing Failed for Doc {doc_id}: {e}")
                await DocumentRepository.update_document_status(bg_db, doc_id, "FAILED")
            
            finally:
                if os.path.exists(temp_file_location):
                    os.remove(temp_file_location)
    
    @staticmethod
    async def fetch_documents(user_id:UUID,db: AsyncSession):
        """
        Retrieves all available documents from the repository.

        Args:
            db (AsyncSession): Database session dependency.

        Returns:
            List[Document]: A list of all document records in the database.

        Raises:
            Exception: If the database query fails.
        """
        try:
            return await DocumentRepository.get_all_documents(user_id,db)
        except Exception as e:
            print(f"Error in service fetch_documents: {e}")
            raise e

    @staticmethod
    async def rename_file(db: AsyncSession,user_id:UUID, doc_id: UUID, new_name: str):
        """
        Updates the display name of a specific document in the database.

        Args:
            db (AsyncSession): Database session dependency.
            doc_id (UUID): The unique identifier of the document to rename.
            new_name (str): The new filename or display name.

        Returns:
            Document: The updated document record.

        Raises:
            Exception: If the update operation fails.
        """
        try:
            return await DocumentRepository.update_document_name(db,user_id, doc_id, new_name)
        except Exception as e:
            print(f"Error in service rename_file: {e}")
            raise e

    @staticmethod
    async def delete_files(db: AsyncSession,user_id:UUID, doc_ids: list[UUID]):
        """
        Deletes multiple documents and their associated data from the system.

        Note: 
            In this implementation, associated vector chunks are typically 
            deleted via database cascading.

        Args:
            db (AsyncSession): Database session dependency.
            doc_ids (list[UUID]): A list of unique identifiers for documents to remove.

        Returns:
            bool: True if the deletion was successful.

        Raises:
            Exception: If the batch deletion fails.
        """
        try: 
            file_urls = await DocumentRepository.delete_documents(db,user_id, doc_ids)

            if not file_urls:
                return True

            # 2. Extract paths from URLs
            # Example: '.../storage/v1/object/public/study-buddy-docs/uploads/myfile.pdf' becomes 'uploads/myfile.pdf'
            file_paths = []
            for url in file_urls:
                # Split to get everything after the bucket name
                encoded_path = url.split("study-buddy-docs/")[-1]
                # Convert %20 back to spaces, etc.
                decoded_path = unquote(encoded_path)
                file_paths.append(decoded_path)
                # Call Supabase remove with the clean paths
                supabase.storage.from_("study-buddy-docs").remove(file_paths)
                return True
        except Exception as e:
            print(f"Error in service delete_files: {e}")
            raise e