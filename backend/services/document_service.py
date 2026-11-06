import asyncio
import hashlib
import logging
import os
from typing import cast
from urllib.parse import unquote
from uuid import UUID

import httpx
from dto.document_dto import DocumentCreate
from fastapi import BackgroundTasks, HTTPException
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from repository.database import async_session_maker
from repository.document_repository import DocumentRepository
from repository.models import DocumentChunk
from sqlalchemy.ext.asyncio import AsyncSession
from utils.cache_manager import CacheManager
from utils.ocr_processor import process_document
from utils.supabase_utils import supabase

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
logger = logging.getLogger(__name__)


class DocumentService:
    @staticmethod
    async def upload_file(db: AsyncSession, user_id: UUID, file: DocumentCreate, background_tasks: BackgroundTasks):
        """Entry point for the non-blocking PDF/TXT upload pipeline"""
        try:
            existing_doc = await DocumentRepository.get_document_by_url(db, user_id, file.file_url)
            if existing_doc:
                return existing_doc

            new_doc = await DocumentRepository.create_document(
                db=db, user_id=user_id, name=file.name, size=file.size, file_url=file.file_url
            )

            await CacheManager.add_user_document(
                user_id=user_id,
                doc_dict={
                    "id": str(new_doc.id),
                    "name": str(new_doc.name),
                    "size": new_doc.size or 0,
                    "upload_date": new_doc.upload_date.isoformat() if getattr(new_doc, "upload_date", None) else None,
                },
            )

            background_tasks.add_task(
                DocumentService._process_pdf_background,
                doc_id=cast(UUID, new_doc.id),
                file_url=file.file_url,
                file_name=file.name,
            )

            return new_doc
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in main thread upload_file: %s", e)
            raise

    @staticmethod
    async def _process_pdf_background(doc_id: UUID, file_url: str, file_name: str):
        """Background worker responsible for in-memory text extraction, Redis staging, and Write-Through chunking."""
        async with async_session_maker() as bg_db:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(file_url)
                    response.raise_for_status()
                    file_bytes = response.content
                full_text, page_count = await asyncio.to_thread(process_document, file_bytes, file_name)
                logger.info("Extracted %s pages (%s chars) in memory for doc %s", page_count, len(full_text), doc_id)

                await CacheManager.stage_document_text(doc_id, full_text, ttl=3600)
                staged_text = await CacheManager.get_staged_document_text(doc_id) or full_text

                text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                chunks = text_splitter.split_text(staged_text)

                embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
                cleaned_texts = [chunk.replace("\x00", "") for chunk in chunks]
                vectors = await asyncio.to_thread(embeddings_model.embed_documents, cleaned_texts)

                new_chunks = []
                cached_chunks = []
                for i, clean_text in enumerate(cleaned_texts):
                    content_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
                    new_chunks.append(
                        DocumentChunk(
                            document_id=doc_id,
                            text_content=clean_text,
                            content_hash=content_hash,
                            embedding=vectors[i],
                        )
                    )
                    cached_chunks.append({
                        "id": i + 1,
                        "content_hash": content_hash,
                        "text_content": clean_text,
                    })

                await DocumentRepository.bulk_create_chunks(bg_db, new_chunks)
                await DocumentRepository.update_document_status(bg_db, doc_id, "READY")
                await CacheManager.set_document_chunks(doc_id, cached_chunks)
                await CacheManager.clear_staged_document_text(doc_id)
                logger.info("Successfully vectorized and cached %s chunks for doc %s", len(new_chunks), doc_id)

            except Exception as e:
                logger.error("Background Processing Failed for Doc %s: %s", doc_id, e)
                await DocumentRepository.update_document_status(bg_db, doc_id, "FAILED")
                await CacheManager.clear_staged_document_text(doc_id)
                raise

                   
    @staticmethod
    async def fetch_documents(user_id: UUID, db: AsyncSession):
        """Retrieves all available documents using Read-Through caching."""
        try:
            cache_key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(cache_key)
            if cached is not None:
                return cached
            docs = await DocumentRepository.get_all_documents(user_id, db)
            serialized = [
                {
                    "id": str(d.id),
                    "name": str(d.name),
                    "size": d.size or 0,
                    "upload_date": d.upload_date.isoformat() if bool(d.upload_date) else None,
                }
                for d in docs
            ]
            await CacheManager.set_json(cache_key, serialized)
            return docs
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in service fetch_documents: %s", e)
            raise

    @staticmethod
    async def rename_file(db: AsyncSession, user_id: UUID, doc_id: UUID, new_name: str):
        """Updates the display name of a specific document (Write-Through)."""
        try:
            doc = await DocumentRepository.update_document_name(db, user_id, doc_id, new_name)
            if doc:
                await CacheManager.update_user_document_name(user_id, doc_id, new_name)
            return doc
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in service rename_file: %s", e)
            raise

    @staticmethod
    async def delete_files(db: AsyncSession, user_id: UUID, doc_ids: list[UUID]) -> bool:
        """Deletes multiple documents and updates cache (Write-Through)."""
        try:
            file_urls = await DocumentRepository.delete_documents(db, user_id, doc_ids)
            file_paths = []
            for url in file_urls:
                encoded_path = url.split("study-buddy-docs/")[-1]
                decoded_path = unquote(encoded_path)
                file_paths.append(decoded_path)
            if file_paths:
                supabase.storage.from_("study-buddy-docs").remove(file_paths)
            await CacheManager.remove_user_documents(user_id, doc_ids)
            return True
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in service delete_files: %s", e)
            raise