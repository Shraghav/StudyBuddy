import logging

import pymupdf
from rapidocr_onnxruntime import RapidOCR

logger = logging.getLogger(__name__)

MAX_ALLOWED_PAGES = 50

def extract_text_from_image_bytes(image_bytes: bytes) -> str:
    """Uses RapidOCR to extract embedded text from raw image bytes."""
    try:
        # Step 1: Initialize RapidOCR ONNX inference engine
        engine = RapidOCR()
        # Step 2: Run optical character recognition on raw image bytes
        result, _ = engine(image_bytes)
        if not result:
            return ""
        # Step 3: Extract and concatenate detected text lines
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
    print(f"\n[OCR PROCESSOR] Starting processing for document: '{file_name}' ({len(source):,} bytes)")
    try:
        # Step 1: Open in-memory PDF stream using PyMuPDF
        doc = pymupdf.open(stream=source, filetype="pdf")
        total_pages = len(doc)
        print(f"[OCR PROCESSOR] Document contains {total_pages} page(s) (Limit: {MAX_ALLOWED_PAGES})")
        # Step 2: Enforce maximum document length constraint (50 pages)
        if total_pages > MAX_ALLOWED_PAGES:
            doc.close()
            print(f"[OCR PROCESSOR] ERROR: Document exceeds limit ({total_pages} > {MAX_ALLOWED_PAGES} pages)")
            raise ValueError(
                f"Document exceeds maximum limit of {MAX_ALLOWED_PAGES} pages. "
                f"Uploaded document has {total_pages} pages. Please upload a smaller document."
            )
        # Step 3: Iterate through each page extracting text and identifying graphical elements
        extracted_pages: list[str] = []
        for page_idx, page in enumerate(doc, start=1):
            page_sections: list[str] = []
            digital_text = page.get_text().strip()
            if digital_text:
                page_sections.append(digital_text)
            
            # Step 4: If text is sparse (<30 chars), render page to 150 DPI PNG pixmap and run full-page OCR
            if len(digital_text) < 30:
                print(f"[OCR PROCESSOR] Page {page_idx}/{total_pages}: Digital text sparse ({len(digital_text)} chars) -> running full-page RapidOCR...")
                pix = page.get_pixmap(dpi=150)
                page_img_bytes = pix.tobytes("png")
                page_ocr = extract_text_from_image_bytes(page_img_bytes)
                if page_ocr.strip():
                    page_sections.append(f"[Page OCR]:\n{page_ocr.strip()}")
            else:
                # Step 5: For text-rich pages, scan and extract embedded diagram images for OCR
                image_list = page.get_images(full=True)
                if image_list:
                    print(f"[OCR PROCESSOR] Page {page_idx}/{total_pages}: Found {len(image_list)} embedded image(s) -> running RapidOCR on diagrams...")
                for img_info in image_list:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    img_bytes = base_image.get("image")
                    if img_bytes:
                        ocr_text = extract_text_from_image_bytes(img_bytes)
                        if ocr_text.strip():
                            page_sections.append(f"[Image OCR]:\n{ocr_text.strip()}")
            # Step 6: Wrap page content in standardized boundary headers
            page_combined = "\n\n".join(page_sections)
            extracted_pages.append(f"--- [Page {page_idx}] ---\n{page_combined}")
        doc.close()
        # Step 7: Combine all extracted pages into a single document string
        full_text = "\n\n".join(extracted_pages)
        print(f"[OCR PROCESSOR] Completed parsing {total_pages} page(s) -> Extracted {len(full_text):,} total characters\n")
        return full_text, total_pages
    except ValueError:
        raise
    except Exception as e:
        print(f"[OCR PROCESSOR] ERROR during document processing: {e}")
        logger.error("Processing document failed in here: %s", e)
        raise
