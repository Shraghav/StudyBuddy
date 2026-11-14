import asyncio
import hashlib
import logging
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
from utils.caching.cache_manager import CacheManager
from utils.ocr_processor import process_document
from utils.supabase_utils import supabase

logger = logging.getLogger(__name__)

class DocumentService:
    @staticmethod
    async def upload_file(db: AsyncSession, user_id: UUID, file: DocumentCreate, background_tasks: BackgroundTasks):
        """Entry point for the non-blocking PDF/TXT upload pipeline"""
        print(f"\n[DOCUMENT SERVICE] >>> Incoming upload request: '{file.name}' for user: {user_id}")
        try:
            # Step 1: Check if document already exists for this user to avoid redundant ingestion
            existing_doc = await DocumentRepository.get_document_by_url(db, user_id, file.file_url)
            if existing_doc and str(existing_doc.status)!="FAILED":
                print(f"[DOCUMENT SERVICE] Found existing document '{existing_doc.name}' (ID: {existing_doc.id}, Status: {existing_doc.status}). Skipping duplicate ingestion.")
                return existing_doc

            # Step 2: Persist new document entity with initial PROCESSING state in database
            new_doc = await DocumentRepository.create_document(
                db=db, user_id=user_id, name=file.name, file_url=file.file_url
            )
            print(f"[DOCUMENT SERVICE] Persisted document record: ID={new_doc.id}, Name='{new_doc.name}', Status={new_doc.status}")

            # Step 3: Cache initial document metadata in Redis
            await CacheManager.add_user_document(
                user_id=user_id,
                doc_dict={
                    "id": str(new_doc.id),
                    "name": str(new_doc.name),
                    "upload_date": new_doc.upload_date.isoformat() if getattr(new_doc, "upload_date", None) else None,
                    "status":new_doc.status,
                    "file_url":new_doc.file_url
                },
            )

            # Step 4: Dispatch background worker for in-memory OCR, text extraction, and vectorization
            print(f"[DOCUMENT SERVICE] Queuing background ingestion task for Doc ID: {new_doc.id} ('{file.name}')")
            background_tasks.add_task(
                DocumentService._process_pdf_background,
                doc_id=cast(UUID, new_doc.id),
                user_id=user_id,
                file_url=file.file_url,
                file_name=file.name,
            )

            # Step 5: Return newly created document record immediately
            return new_doc
        except HTTPException:
            raise
        except Exception as e:
            print(f"[DOCUMENT SERVICE] ERROR in upload_file: {e}")
            logger.error("Error in main thread upload_file: %s", e)
            raise

    @staticmethod
    async def _process_pdf_background(doc_id: UUID, user_id: UUID, file_url: str, file_name: str):
        """Background worker responsible for in-memory text extraction, Redis staging, and Write-Through chunking."""
        print(f"\n{'='*70}\n[DOCUMENT SERVICE - BACKGROUND] Ingestion pipeline started for Doc ID: {doc_id} ('{file_name}')\n{'='*70}")
        async with async_session_maker() as bg_db:
            try:
                # Step 1: Download raw file bytes asynchronously in-memory using httpx
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 1/6: Downloading binary from storage: {file_url}")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(file_url)
                    response.raise_for_status()
                    file_bytes = response.content
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 1/6: Successfully downloaded {len(file_bytes):,} bytes.")

                # Step 2: Offload CPU-heavy text extraction and RapidOCR to worker thread
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 2/6: Running in-memory text parsing & RapidOCR...")
                full_text, page_count = await asyncio.to_thread(process_document, file_bytes, file_name)
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 2/6: Text extraction complete! Extracted {page_count} pages, {len(full_text):,} total characters.")
                logger.info("Extracted %s pages (%s chars) in memory for doc %s", page_count, len(full_text), doc_id)

                # Step 3: Split document into overlapping character chunks
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 3/6: Chunking text with RecursiveCharacterTextSplitter (chunk_size=1000, overlap=200)...")
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                chunks = text_splitter.split_text(full_text)
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 3/6: Generated {len(chunks)} text chunks.")

                # Step 4: Sanitize text and generate dense vector embeddings using Google Gemini
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 4/6: Computing dense vector embeddings with Google Gemini (gemini-embedding-001)...")
                embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
                cleaned_texts = [chunk.replace("\x00", "") for chunk in chunks]
                vectors = await asyncio.to_thread(embeddings_model.embed_documents, cleaned_texts)
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 4/6: Generated {len(vectors)} embedding vectors.")

                # Step 5: Construct DocumentChunk models and compute MD5 hashes for deduplication
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 5/6: Constructing chunk models and MD5 checksums for pgvector...")
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

                # Step 6: Persist chunks to pgvector database and update status to READY
                print(f"[DOCUMENT SERVICE - BACKGROUND] Step 6/6: Persisting {len(new_chunks)} chunks to pgvector and setting status to 'READY'...")
                await DocumentRepository.bulk_create_chunks(bg_db, new_chunks)
                await DocumentRepository.update_document_status(bg_db, doc_id, "READY")

                # Step 7: Write-through cache chunk metadata into Redis and update user document status in Redis
                await CacheManager.set_document_chunks(doc_id, cached_chunks)
                await CacheManager.update_user_document_status(user_id, doc_id, "READY")
                print(f"[DOCUMENT SERVICE - BACKGROUND] SUCCESS! Cached {len(cached_chunks)} chunks in Redis. Doc ID {doc_id} ('{file_name}') is now READY!\n{'='*70}\n")
                logger.info("Successfully vectorized and cached %s chunks for doc %s", len(new_chunks), doc_id)
            except Exception as e:
                # Step 8: Update status to FAILED on any processing error
                print(f"[DOCUMENT SERVICE - BACKGROUND] ERROR processing Doc ID {doc_id}: {e}\n{'='*70}\n")
                logger.error("Background Processing Failed for Doc %s: %s", doc_id, e)
                await DocumentRepository.update_document_status(bg_db, doc_id, "FAILED")
                await CacheManager.update_user_document_status(user_id, doc_id, "FAILED")
                raise
             
    @staticmethod
    async def fetch_documents(user_id: UUID, db: AsyncSession):
        """Retrieves all available documents using Read-Through caching with self-healing."""
        print(f"[DOCUMENT SERVICE] Fetching documents for user: {user_id}")
        try:
            # Step 1: Query Redis read-through cache for user documents
            cache_key = CacheManager.user_documents_key(user_id)
            cached = await CacheManager.get_json(cache_key)
            if cached is not None:
                # Self-healing: if any document is still cached as Processing, query DB to see if background task finished
                has_processing = any(
                    str(d.get("status", "")).upper() == "PROCESSING" for d in cached
                )
                if not has_processing:
                    print(f"[DOCUMENT SERVICE] Cache HIT: Retrieved {len(cached)} documents from Redis for user: {user_id}")
                    return cached

            # Step 2: Query database on cache miss or to resolve in-flight processing status
            print(f"[DOCUMENT SERVICE] Cache MISS / Refresh: Fetching documents from PostgreSQL database for user: {user_id}")
            docs = await DocumentRepository.get_all_documents(user_id, db)
            
            # Step 3: Serialize documents and update Redis cache
            serialized = [
                {
                    "id": str(d.id),
                    "name": str(d.name),
                    "upload_date": d.upload_date.isoformat() if bool(d.upload_date) else None,
                    "status": d.status,
                    "file_url": d.file_url
                }
                for d in docs
            ]
            await CacheManager.set_json(cache_key, serialized)
            print(f"[DOCUMENT SERVICE] Retrieved {len(docs)} documents from database and refreshed Redis cache.")
            return docs
        except HTTPException:
            raise
        except Exception as e:
            print(f"[DOCUMENT SERVICE] ERROR in fetch_documents: {e}")
            logger.error("Error in service fetch_documents: %s", e)
            raise

    @staticmethod
    async def rename_file(db: AsyncSession, user_id: UUID, doc_id: UUID, new_name: str):
        """Updates the display name of a specific document (Write-Through)."""
        print(f"[DOCUMENT SERVICE] Renaming document ID: {doc_id} to '{new_name}' (User: {user_id})")
        try:
            # Step 1: Update document filename in database
            doc = await DocumentRepository.update_document_name(db, user_id, doc_id, new_name)
            # Step 2: Write-through update name in cache
            if doc:
                await CacheManager.update_user_document_name(user_id, doc_id, new_name)
                print(f"[DOCUMENT SERVICE] Successfully renamed document ID: {doc_id} to '{new_name}'")
            return doc
        except HTTPException:
            raise
        except Exception as e:
            print(f"[DOCUMENT SERVICE] ERROR in rename_file: {e}")
            logger.error("Error in service rename_file: %s", e)
            raise

    @staticmethod
    async def delete_files(db: AsyncSession, user_id: UUID, doc_ids: list[UUID]):
        """Deletes multiple documents and updates cache (Write-Through)."""
        print(f"[DOCUMENT SERVICE] Deleting {len(doc_ids)} documents for user: {user_id}: {doc_ids}")
        try:
            # Step 1: Remove document records from database and collect storage URLs
            file_urls = await DocumentRepository.delete_documents(db, user_id, doc_ids)

            # Step 2: Extract and URL-decode storage file paths
            file_paths = []
            for url in file_urls:
                encoded_path = url.split("study-buddy-docs/")[-1]
                decoded_path = unquote(encoded_path)
                file_paths.append(decoded_path)

            # Step 3: Remove binary files from Supabase Storage bucket
            if file_paths:
                supabase.storage.from_("study-buddy-docs").remove(file_paths)
                print(f"[DOCUMENT SERVICE] Removed {len(file_paths)} files from Supabase Storage bucket 'study-buddy-docs'")

            # Step 4: Evict deleted documents from Redis cache
            await CacheManager.remove_user_documents(user_id, doc_ids)
            print(f"[DOCUMENT SERVICE] Evicted {len(doc_ids)} documents from Redis cache.")
            return {"message": f"Successfully deleted {len(doc_ids)} documents"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"[DOCUMENT SERVICE] ERROR in delete_files: {e}")
            logger.error("Error in service delete_files: %s", e)
            raise