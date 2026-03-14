import hashlib
import os
import uuid
from urllib.parse import unquote
from uuid import UUID

import httpx
from dto.document_dto import DocumentCreate
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from repository.document_repository import DocumentRepository
from repository.models import DocumentChunk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from utils.supabase_utils import supabase

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DocumentService:
    @staticmethod
    async def upload_file(db: AsyncSession,user_id:UUID, file: DocumentCreate):
        """
        Handles the end-to-end workflow for uploading a new PDF document.

        Workflow:
        1. Saves the physical file to the local UPLOAD_DIR.
        2. Persists document metadata and binary content to the database.
        3. Loads and parses the PDF text content.
        4. Splits text into chunks and generates vector embeddings using Google Gemini.
        5. Stores unique document chunks and embeddings for vector search.

        Args:
            db (AsyncSession): Database session dependency.
            file (DocumentCreate): The uploaded file object.

        Returns:
            Document: The newly created document database record.

        Raises:
            Exception: If file writing, database persistence, or embedding generation fails.
        """
        try:
            unique_filename = f"{uuid.uuid4()}_{file.name}"
            temp_file_location = f"{UPLOAD_DIR}/{unique_filename}"
            new_doc = await DocumentRepository.create_document(
                db=db,user_id = user_id, name=file.name, size=file.size, file_url=file.file_url
            )

            async with httpx.AsyncClient() as client:
                response = await client.get(file.file_url)
                response.raise_for_status()
                
                with open(temp_file_location, "wb") as f:
                    f.write(response.content)

            loader = PyPDFLoader(temp_file_location)
            docs = loader.load()
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            splits = text_splitter.split_documents(docs)

            embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
            
            for chunk in splits:
               raw_text = chunk.page_content
               clean_text = raw_text.replace("\x00", "") 
               content_hash = hashlib.md5(clean_text.encode('utf-8')).hexdigest()
               result = await db.execute(
                    select(DocumentChunk).where(DocumentChunk.content_hash == content_hash)
                )
               existing_chunk = result.scalar_one_or_none()

               if not existing_chunk:
                    vector = embeddings_model.embed_query(clean_text)
                    new_chunk = DocumentChunk(
                        document_id=new_doc.id,
                        text_content=clean_text,
                        content_hash=content_hash,
                        embedding=vector
                    )
                    db.add(new_chunk)
                
            await db.commit() 
            return new_doc
        except Exception as e:
            print(f"Error in service upload_file: {e}")
            if new_doc and new_doc.id:
                await db.delete(new_doc)
                await db.commit()
            raise e
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