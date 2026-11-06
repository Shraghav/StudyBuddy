import logging

import pymupdf
from rapidocr_onnxruntime import RapidOCR

logger = logging.getLogger(__name__)

MAX_ALLOWED_PAGES = 50

def extract_text_from_image_bytes(image_bytes: bytes) -> str:
    """Uses RapidOCR to extract embedded text from raw image bytes."""
    try:
        engine = RapidOCR()
        result, _ = engine(image_bytes)
        if not result:
            return ""
        extracted_lines = [line[1] for line in result if len(line) > 1 and line[1]]
        return "\n".join(extracted_lines)
    except Exception as e:
        logger.warning("RapidOCR failed on image bytes: %s", e)
        raise


def process_document(source: bytes, file_name: str = "") -> tuple[str, int]:
    """Ingests a document (.pdf or .txt) from in-memory bytes or a file path,
    enforces the 50-page limit, and extracts textual content including scanned/image pages via RapidOCR.

    Returns:
        tuple[str, int]: (combined_text, page_count)
    Raises:
        ValueError: If file type is unsupported or page count exceeds 50.
    """
    try:
        doc = pymupdf.open(stream=source, filetype="pdf")
        total_pages = len(doc)
        if total_pages > MAX_ALLOWED_PAGES:
            doc.close()
            raise ValueError(
                f"Document exceeds maximum limit of {MAX_ALLOWED_PAGES} pages. "
                f"Uploaded document has {total_pages} pages. Please upload a smaller document."
            )
        extracted_pages: list[str] = []
        for page_idx, page in enumerate(doc, start=1):
            page_sections: list[str] = []
            digital_text = page.get_text().strip()
            if digital_text:
                page_sections.append(digital_text)
            print("Digital text:", digital_text)
            if len(digital_text) < 30:
                pix = page.get_pixmap(dpi=150)
                page_img_bytes = pix.tobytes("png")
                page_ocr = extract_text_from_image_bytes(page_img_bytes)
                if page_ocr.strip():
                    page_sections.append(f"[Page OCR]:\n{page_ocr.strip()}")
            else:
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    img_bytes = base_image.get("image")
                    if img_bytes:
                        ocr_text = extract_text_from_image_bytes(img_bytes)
                        if ocr_text.strip():
                            page_sections.append(f"[Image OCR]:\n{ocr_text.strip()}")
            page_combined = "\n\n".join(page_sections)
            extracted_pages.append(f"--- [Page {page_idx}] ---\n{page_combined}")
        print("Extracted pages:", extracted_pages)
        doc.close()
        full_text = "\n\n".join(extracted_pages)
        return full_text, total_pages
    except ValueError:
        raise
    except Exception as e:
        logger.error("Processing document failed in here: %s", e)
        raise
