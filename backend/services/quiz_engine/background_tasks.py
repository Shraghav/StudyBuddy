import asyncio
import logging
from uuid import UUID

import httpx
from dto.enums import QuizStatus
from repository.database import async_session_maker
from repository.quiz_repository import QuizRepository
from services.quiz_engine.ai_handler import QuizAIHandler
from sqlalchemy.exc import SQLAlchemyError
from utils.caching.cache_manager import CacheManager
from utils.ocr_processor import process_document

logger = logging.getLogger(__name__)


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
    """Background task to generate quiz questions using Write-Through cached chunks or in-memory retrieval."""
    async with async_session_maker() as db:
        try:
            await asyncio.sleep(1)
            # Step 1: Fetch target quiz session and verify user ownership
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id=user_id)
            if not session:
                logger.error(f"Generation failed: Session {session_id} not found.")
                return

            # Step 2: Look up linked document record from database
            document_id = session.document_id
            document_data = await QuizRepository.get_document_data(db, document_id)
            if not document_data:
                raise ValueError(f"Document or file URL missing for ID: {document_id}")

            # Step 3: Retrieve text from Redis write-through cache or fallback to in-memory PDF extraction
            cached_chunks = await CacheManager.get_document_chunks(document_id)
            if cached_chunks:
                logger.info(
                    "Retrieved %s chunks from Write-Through Redis Cache for doc %s",
                    len(cached_chunks),
                    document_id,
                )
                context_text = "\n\n".join(c["text_content"] for c in cached_chunks)
            else:
                logger.info("Cache miss for doc %s chunks, downloading in memory from storage", document_id)
                context_text = await _extract_text_from_pdf_url(document_data.file_url, document_data.name)

            if not context_text.strip():
                raise ValueError("Extracted document text was empty.")

            # Step 4: Invoke AI model to generate structured question set from context text
            questions_data = await QuizAIHandler.generate_questions(context_text, session.setup_params)
            if not questions_data:
                raise ValueError("AI failed to generate any questions.")

            # Step 5: Save generated questions and transition session status to active
            await QuizRepository.save_generated_questions(db, session_id, questions_data, user_id)
            logger.info(f"Successfully generated quiz for session {session_id}")

        except ValueError as ve:
            # Step 6a: Rollback and mark session status as error on validation failure
            await db.rollback()
            logger.error(f"Validation Error (generate_quiz): {ve}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

        except SQLAlchemyError as sqle:
            # Step 6b: Rollback and mark session status as error on DB exception
            await db.rollback()
            logger.error(f"Database Error (generate_quiz): {sqle}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

        except Exception as e:  # noqa: BLE001
            # Step 6c: Rollback and mark session status as error on unexpected error
            await db.rollback()
            logger.error(f"Unexpected Error (generate_quiz): {e}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )