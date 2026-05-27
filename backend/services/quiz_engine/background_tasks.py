import asyncio
import logging
import os
from typing import List
import uuid
from uuid import UUID
import numpy as np
import httpx
from langchain_community.document_loaders import PyPDFLoader
from dto.enums import QuizStatus
from dto.quiz_dto import QuizQuestionRequest
from repository.database import async_session_maker
from repository.quiz_repository import QuizRepository
from services.quiz_engine.ai_handler import QuizAIHandler
from sqlalchemy.exc import SQLAlchemyError
from pdf2image import convert_from_path
from rapidocr_onnxruntime import RapidOCR

logger = logging.getLogger(__name__)
UPLOAD_DIR = "./temp_uploads"
engine = RapidOCR()
async def _extract_text_from_pdf_url(file_url: str, original_filename: str = "document.pdf") -> str:
    """Downloads the file, extracts clean text, and guarantees local deletion."""
    unique_filename = f"{uuid.uuid4()}_{original_filename}"
    temp_file_location = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            with open(temp_file_location, "wb") as f:
                f.write(response.content)
        loader = PyPDFLoader(temp_file_location)
        docs = loader.load()
        native_text = "\n".join([d.page_content for d in docs]).strip()
        if len(native_text) > 50: 
            return native_text
        images = convert_from_path(temp_file_location, dpi=200)
        ocr_results = []
        for img in images:
            result, _ = engine(np.array(img))
            if result:
                ocr_results.append(" ".join([line[1] for line in result]))
                    
        return "\n".join(ocr_results)
        
    except httpx.HTTPError as e:
        logger.error(f"Failed to download PDF from {file_url}: {str(e)}")
        raise ValueError("Failed to retrieve document from storage.")
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {str(e)}")
        raise ValueError("Failed to parse document content.")  
    finally:
        if os.path.exists(temp_file_location):
            os.remove(temp_file_location)

async def generate_quiz_task(session_id: UUID, user_id:UUID):
    async with async_session_maker() as db:
        try:
            await asyncio.sleep(1)
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id=user_id) 
            if not session:
                logger.error(f"Generation failed: Session {session_id} not found.")
                return
            
            document_id = session.document_id
            print("Doc:", document_id)
            document_data = await QuizRepository.get_document_data(db, document_id) 
            
            if not document_data or not document_data:
                raise ValueError(f"Document or file URL missing for ID: {document_id}")
            
            print("URL for document:", document_data.file_url)
            context_text = await _extract_text_from_pdf_url(document_data.file_url, document_data.name)
            
            if not context_text.strip():
                raise ValueError("Extracted document text was empty.")
            
            questions_data = await QuizAIHandler.generate_questions(context_text, session.setup_params)
            if not questions_data:
                raise ValueError("AI failed to generate any questions.")

            await QuizRepository.save_generated_questions(db, session_id, questions_data, user_id)
            logger.info(f"Successfully generated quiz for session {session_id}")

        except ValueError as ve:
            await db.rollback()
            logger.error(f"Validation Error (generate_quiz): {str(ve)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )
            
        except SQLAlchemyError as sqle:
            await db.rollback()
            logger.error(f"Database Error (generate_quiz): {str(sqle)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Unexpected Error (generate_quiz): {str(e)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

async def grade_text_quiz_task(session_id: UUID, user_submissions: List[QuizQuestionRequest], user_id:UUID):
    async with async_session_maker() as db:
        try:
            print("Session id:", session_id)
            session = await QuizRepository.get_quiz_session_by_id(db, session_id, user_id)
            if not session:
                logger.error(f"Grading failed: Session {session_id} not found.")
                return

            document_id = session.document_id
            print("Document id:", document_id)
            document_data = await QuizRepository.get_document_data(db, document_id)
            
            if not document_data or not document_data.file_url:
                raise ValueError(f"Document metadata missing during grading for ID: {document_id}")

            context_text = await _extract_text_from_pdf_url(document_data.file_url, document_data.name)
            qa_payload = []
            question_map = {str(q.id): q for q in session.questions}
            print("User submission:", user_submissions)
            print("Question map:", question_map)
            for sub in user_submissions:
                q_id_str = str(sub.question_id)
                question = question_map.get(q_id_str)
                
                if question:
                    qa_payload.append({
                        "question_id": str(question.id),
                        "question_text": question.text,
                        "correct_answer": question.correct_answer,
                        "user_answer": sub.user_answer or "",
                    })
            
            print("Matching questions:", qa_payload)
            if not qa_payload:
                raise ValueError("No matching questions found between database and submissions.")

            evaluations = await QuizAIHandler.evaluate_text_answers(qa_payload, context_text)
            if evaluations and len(evaluations) > 0:
                total_points = sum(float(e.get("score", 0.0)) for e in evaluations)
                avg_score = int(total_points / len(evaluations))
            else:
                logger.warning(f"AI returned empty evaluations for session {session_id}")
                avg_score = 0
                evaluations = [] 
            print("Average score:",avg_score )
            print("Evaluation:",evaluations)
            await QuizRepository.save_text_evaluation(db, session_id, evaluations, avg_score, user_id)
            logger.info(f"Successfully graded text quiz for session {session_id}")

        except ValueError as ve:
            await db.rollback()
            logger.error(f"Validation Error (grade_text): {str(ve)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

        except SQLAlchemyError as sqle:
            await db.rollback()
            logger.error(f"Database Error (grade_text): {str(sqle)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Unexpected Error (grade_text): {str(e)}")
            await QuizRepository.update_quiz_data(
                db=db, user_id=user_id, session_id=session_id, status=QuizStatus.error
            )