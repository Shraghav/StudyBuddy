import hashlib
import os
from uuid import UUID

from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from repository.document_repository import DocumentRepository
from repository.models import DocumentChunk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DocumentService:
    @staticmethod
    async def upload_file(db: AsyncSession, file: UploadFile):
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
            file (UploadFile): The uploaded multipart file object.

        Returns:
            Document: The newly created document database record.

        Raises:
            Exception: If file writing, database persistence, or embedding generation fails.
        """
        try:
            file_location = f"{UPLOAD_DIR}/{file.filename}"
            content = await file.read() 
            
            with open(file_location, "wb") as f:
                f.write(content)
                
            file_size = len(content)
            new_doc = await DocumentRepository.create_document(
                db=db, name=file.filename, size=file_size, file_content=content
            )

            loader = PyPDFLoader(file_location)
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
            raise e
            
    @staticmethod
    async def fetch_documents(db: AsyncSession):
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
            return await DocumentRepository.get_all_documents(db)
        except Exception as e:
            print(f"Error in service fetch_documents: {e}")
            raise e

    @staticmethod
    async def rename_file(db: AsyncSession, doc_id: UUID, new_name: str):
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
            return await DocumentRepository.update_document_name(db, doc_id, new_name)
        except Exception as e:
            print(f"Error in service rename_file: {e}")
            raise e

    @staticmethod
    async def delete_files(db: AsyncSession, doc_ids: list[UUID]):
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
            return await DocumentRepository.delete_documents(db, doc_ids)
        except Exception as e:
            print(f"Error in service delete_files: {e}")
            raise e