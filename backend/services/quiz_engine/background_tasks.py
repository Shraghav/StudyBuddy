import asyncio
import logging
import random
from uuid import UUID

import httpx
from dto.enums import QuizStatus
from langchain_text_splitters import RecursiveCharacterTextSplitter
from repository.database import async_session_maker
from repository.quiz_repository import QuizRepository
from services.quiz_engine.ai_handler import QuizAIHandler
from sqlalchemy.exc import SQLAlchemyError
from utils.caching.cache_manager import CacheManager
from utils.ocr_processor import process_document

logger = logging.getLogger(__name__)


def select_random_chunks(
    chunks: list[str],
    num_questions: int = 5,
    min_chunks: int = 4,
    max_chunks: int = 10,
) -> list[str]:
    """Randomly selects a subset of chunks to reduce LLM token usage while preserving document flow."""
    total = len(chunks)
    if total <= min_chunks:
        return chunks

    # Dynamically scale target chunk count with requested questions (capped between min_chunks and max_chunks)
    target_count = max(min_chunks, min(num_questions + 2, max_chunks))
    target_count = min(target_count, total)

    # Pick random indices and sort to maintain narrative order
    selected_indices = sorted(random.sample(range(total), target_count))
    return [chunks[i] for i in selected_indices]


async def _extract_text_from_pdf_url(file_url: str, original_filename: str = "document.pdf") -> str:
    """Downloads the file directly in memory and extracts clean text without creating temp files on disk."""
    try:
        # Step 1: Download raw PDF bytes asynchronously using httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            file_bytes = response.content

        # Step 2: Run in-memory text parsing and RapidOCR offloaded to a worker thread
        full_text, _ = await asyncio.to_thread(process_document, file_bytes, original_filename)
        return full_text
    except httpx.HTTPError as e:
        logger.error(f"Failed to download PDF from {file_url}: {e}")
        raise ValueError("Failed to retrieve document from storage.")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to extract text from PDF: {e}")
        raise ValueError("Failed to parse document content.")


async def generate_quiz_task(session_id: UUID, user_id: UUID):
    """Background task to generate quiz questions using sampled chunks to optimize token usage."""
    print(f"\n{'='*70}\n[QUIZ ENGINE - TASK] Initiating background quiz generation for Session: {session_id} (User: {user_id})\n{'='*70}")
    async with async_session_maker() as db:
        try:
            await asyncio.sleep(1)
            # Step 1: Fetch target quiz session and verify user ownership
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id=user_id)
            if not session:
                print(f"[QUIZ ENGINE - TASK] ERROR: Session {session_id} not found in database.")
                logger.error(f"Generation failed: Session {session_id} not found.")
                return

            # Step 2: Look up linked document record from database
            document_id = session.document_id
            document_data = await QuizRepository.get_document_data(db, document_id)
            if not document_data:
                print(f"[QUIZ ENGINE - TASK] ERROR: Document record or storage URL missing for ID: {document_id}")
                raise ValueError(f"Document or file URL missing for ID: {document_id}")

            # Parse num_questions to guide random chunk selection size
            params = session.setup_params or {}
            num_questions = int(params.get("numQuestions") or 5)
            difficulty = params.get("difficulty") or "Medium"
            print(f"[QUIZ ENGINE - TASK] Session: '{session.title}' | Target: {num_questions} questions ({difficulty}) | Doc: '{document_data.name}' (ID: {document_id})")

            # Step 3: Retrieve text chunks (Redis cache -> DB pgvector chunks -> OCR fallback)
            chunks: list[str] = []
            cached_chunks = await CacheManager.get_document_chunks(document_id)
            if cached_chunks:
                print(f"[QUIZ ENGINE - TASK] Retrieved {len(cached_chunks)} chunks from Redis Write-Through cache.")
                logger.info(
                    "Retrieved %s chunks from Write-Through Redis Cache for doc %s",
                    len(cached_chunks),
                    document_id,
                )
                chunks = [c["text_content"] for c in cached_chunks if c.get("text_content")]

            if not chunks:
                print(f"[QUIZ ENGINE - TASK] Redis cache miss for doc {document_id} chunks. Querying PostgreSQL pgvector chunks...")
                logger.info("Cache miss for doc %s chunks, checking database", document_id)
                db_chunks = await QuizRepository.get_document_chunks(db, document_id)
                if db_chunks:
                    print(f"[QUIZ ENGINE - TASK] Retrieved {len(db_chunks)} chunks from pgvector database. Repopulating Redis...")
                    logger.info("Retrieved %s chunks from DB for doc %s", len(db_chunks), document_id)
                    chunks = db_chunks
                    try:
                        await CacheManager.set_document_chunks(
                            document_id,
                            [{"id": i + 1, "text_content": t} for i, t in enumerate(db_chunks)],
                        )
                    except Exception as cache_err:  # noqa: BLE001
                        logger.warning("Failed to repopulate Redis cache for doc %s: %s", document_id, cache_err)

            if not chunks:
                print(f"[QUIZ ENGINE - TASK] Chunks missing in cache and DB. Downloading raw document from storage for on-the-fly OCR...")
                logger.info("Chunks missing in cache and DB for doc %s, downloading in memory from storage", document_id)
                full_text = await _extract_text_from_pdf_url(document_data.file_url, document_data.name)
                if full_text.strip():
                    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                    chunks = text_splitter.split_text(full_text)
                    print(f"[QUIZ ENGINE - TASK] On-the-fly parsing complete: extracted {len(chunks)} chunks.")

            if not chunks or not any(c.strip() for c in chunks):
                print(f"[QUIZ ENGINE - TASK] ERROR: Extracted document text was empty for doc {document_id}")
                raise ValueError("Extracted document text was empty.")

            # Step 4: Randomly sample chunks to minimize token consumption
            selected_chunks = select_random_chunks(
                chunks,
                num_questions=num_questions,
                min_chunks=4,
                max_chunks=10,
            )
            print(f"[QUIZ ENGINE - TASK] Sampled {len(selected_chunks)} chunks out of {len(chunks)} total chunks for LLM prompt context.")
            logger.info(
                "Sampled %s random chunks out of %s total chunks for quiz session %s (document %s)",
                len(selected_chunks),
                len(chunks),
                session_id,
                document_id,
            )
            context_text = "\n\n".join(selected_chunks)

            # Step 5: Invoke AI model to generate structured question set from sampled context text
            print(f"[QUIZ ENGINE - TASK] Calling QuizAIHandler.generate_questions with {len(context_text):,} chars of context...")
            questions_data = await QuizAIHandler.generate_questions(context_text, session.setup_params)
            if not questions_data:
                print(f"[QUIZ ENGINE - TASK] ERROR: AI failed to generate any questions.")
                raise ValueError("AI failed to generate any questions.")

            # Step 6: Save generated questions and transition session status to active
            print(f"[QUIZ ENGINE - TASK] Generated {len(questions_data)} questions successfully! Persisting to database...")
            await QuizRepository.save_generated_questions(db, session_id, questions_data, user_id)
            await CacheManager.invalidate_user_quiz_sidebar(user_id)
            print(f"[QUIZ ENGINE - TASK] SUCCESS: Quiz session {session_id} is now ACTIVE!\n{'='*70}\n")
            logger.info(f"Successfully generated quiz for session {session_id}")

        except ValueError as ve:
            # Step 6a: Rollback and mark session status as error on validation failure
            await db.rollback()
            print(f"[QUIZ ENGINE - TASK] Validation Error: {ve}\n{'='*70}\n")
            logger.exception("Validation Error (generate_quiz): %s", ve)
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )
            await CacheManager.invalidate_user_quiz_sidebar(user_id)

        except SQLAlchemyError as sqle:
            # Step 6b: Rollback and mark session status as error on DB exception
            await db.rollback()
            print(f"[QUIZ ENGINE - TASK] Database Error: {sqle}\n{'='*70}\n")
            logger.exception("Database Error (generate_quiz): %s", sqle)
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )
            await CacheManager.invalidate_user_quiz_sidebar(user_id)

        except Exception as e:  # noqa: BLE001
            # Step 6c: Rollback and mark session status as error on unexpected error
            await db.rollback()
            print(f"[QUIZ ENGINE - TASK] Unexpected Error: {e}\n{'='*70}\n")
            logger.exception("Unexpected Error (generate_quiz): %s", e)
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )
            await CacheManager.invalidate_user_quiz_sidebar(user_id)