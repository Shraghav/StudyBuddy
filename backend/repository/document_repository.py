from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from uuid import UUID
from repository.models import Document, DocumentChunk 

class DocumentRepository:
    
    @staticmethod
    async def create_document(db: AsyncSession, name: str, size: int, file_content:bytes) -> Document:
        """
        Creates and persists a new Document record with binary content.

        Args:
            db (AsyncSession): Database session dependency.
            name (str): The name of the file.
            size (int): The file size in bytes.
            file_content (bytes): The raw binary content of the PDF.

        Returns:
            Document: The persisted and refreshed document instance.

        Raises:
            Exception: If the insertion fails, triggering a session rollback.
        """
        try:
            new_doc = Document(name=name,size=size, file_content=file_content)
            db.add(new_doc)
            await db.commit()
            await db.refresh(new_doc)
            return new_doc
        except Exception as e:
            await db.rollback()
            print(f"Error in repo create_document: {e}")
            raise e

    @staticmethod
    async def get_all_documents(db: AsyncSession):
        """
        Retrieves all documents from the database ordered by upload date.

        Args:
            db (AsyncSession): Database session dependency.

        Returns:
            List[Document]: A list of documents sorted by newest upload first.

        Raises:
            Exception: If the select query fails.
        """
        try:
            result = await db.execute(select(Document).order_by(Document.upload_date.desc()))
            return result.scalars().all()
        except Exception as e:
            print(f"Error in repo get_all_documents: {e}")
            raise e

    @staticmethod
    async def update_document_name(db: AsyncSession, doc_id: UUID, new_name: str):
        """
        Updates the filename of an existing document record.

        Args:
            db (AsyncSession): Database session dependency.
            doc_id (UUID): The unique identifier of the document.
            new_name (str): The target new name for the document.

        Returns:
            Document | None: The updated document instance, or None if not found.

        Raises:
            Exception: If the update fails, triggering a session rollback.
        """
        try:
            result = await db.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one_or_none()
            if doc:
                doc.name = new_name
                await db.commit()
                await db.refresh(doc)
            return doc
        except Exception as e:
            await db.rollback()
            print(f"Error in repo update_document_name: {e}")
            raise e

    @staticmethod
    async def delete_documents(db: AsyncSession, doc_ids: list[UUID]):
        """
        Deletes a batch of documents based on a list of unique identifiers.

        Note:
            Ensure database foreign keys are set to 'ON DELETE CASCADE' 
            to remove associated chunks automatically.

        Args:
            db (AsyncSession): Database session dependency.
            doc_ids (list[UUID]): List of UUIDs to be removed.

        Returns:
            bool: True if the deletion commit was successful.

        Raises:
            Exception: If the batch delete fails, triggering a session rollback.
        """
        try:
            await db.execute(delete(Document).where(Document.id.in_(doc_ids)))
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            print(f"Error in repo delete_documents: {e}")
            raise e
    
    @staticmethod
    async def get_similar_chunks(db: AsyncSession, document_id: UUID, query_vector: list[float], limit: int = 5) -> List[DocumentChunk]:
        """
        Performs a vector similarity search using L2 distance (Euclidean distance).

        This method queries the DocumentChunk table to find text segments 
        most relevant to the user's question vector.

        Args:
            db (AsyncSession): Database session dependency.
            document_id (UUID): The document context to search within.
            query_vector (list[float]): The embedding vector of the user's query.
            limit (int): Number of relevant chunks to retrieve. Defaults to 5.

        Returns:
            List[DocumentChunk]: Chunks ordered by similarity (lowest distance first).

        Raises:
            Exception: If the vector distance query fails.
        """
        try:
            query = select(DocumentChunk).where(
                DocumentChunk.document_id == document_id
            ).order_by(
                DocumentChunk.embedding.l2_distance(query_vector)
            ).limit(limit)
            
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            print(f"Error in repo get_similar_chunks: {e}")
            raise e

    @staticmethod
    async def get_chunk_by_hash(db: AsyncSession, content_hash: str) -> DocumentChunk | None:
        """
        Checks for existing text chunks using an MD5 content hash.

        Used to prevent duplicate embedding generation and storage 
        for identical text segments.

        Args:
            db (AsyncSession): Database session dependency.
            content_hash (str): The MD5 hash of the chunk's text content.

        Returns:
            DocumentChunk | None: The existing chunk if found, else None.

        Raises:
            Exception: If the hash lookup fails.
        """
        try:
            query = select(DocumentChunk).where(DocumentChunk.content_hash == content_hash)
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            print(f"Error in repo get_chunk_by_hash: {e}")
            raise e

    @staticmethod
    async def save_chunks(db: AsyncSession, chunks: List[DocumentChunk]):
        """
        Persists a batch of generated text chunks and their embeddings.

        Args:
            db (AsyncSession): Database session dependency.
            chunks (List[DocumentChunk]): A list of chunk instances to be saved.

        Raises:
            Exception: If the bulk insertion fails, triggering a session rollback.
        """
        try:
            print(f"In doc repo: saving {len(chunks)} chunks")
            db.add_all(chunks) 
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Error in repo save_chunks: {e}")
            raise e