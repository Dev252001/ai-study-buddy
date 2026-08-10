"""
PDF text extractor.
Uses PyMuPDF (fitz) as the primary engine with pdfplumber as fallback,
and pytesseract/Pillow for scanned (image-only) PDFs.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Heuristic threshold: avg chars-per-page below this → treat as scanned
_SCANNED_THRESHOLD = 50


class PDFProcessor:
    def extract_text(self, file_path: str) -> tuple[str, int]:
        """
        Return *(text, page_count)*.

        Tries PyMuPDF first; falls back to pdfplumber; if both yield < threshold
        characters per page the PDF is considered scanned and OCR is attempted.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {file_path}")

        text, page_count = self._extract_with_pymupdf(file_path)
        if not text.strip():
            logger.info("pymupdf_empty_fallback_pdfplumber", extra={"path": file_path})
            text, page_count = self._extract_with_pdfplumber(file_path)

        if self._is_low_text(text, page_count):
            logger.info("pdf_scanned_attempting_ocr", extra={"path": file_path})
            try:
                ocr_text = self.extract_with_ocr(file_path)
                if ocr_text.strip():
                    text = ocr_text
            except Exception as exc:  # OCR is best-effort
                logger.warning("ocr_failed", extra={"path": file_path, "error": str(exc)})

        return text, page_count

    # ------------------------------------------------------------------
    def _extract_with_pymupdf(self, file_path: str) -> tuple[str, int]:
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(file_path)
            pages: list[str] = []
            for page in doc:
                pages.append(page.get_text("text"))  # type: ignore[attr-defined]
            doc.close()
            return "\n".join(pages), len(pages)
        except Exception as exc:
            logger.warning("pymupdf_error", extra={"error": str(exc)})
            return "", 0

    def _extract_with_pdfplumber(self, file_path: str) -> tuple[str, int]:
        try:
            import pdfplumber

            pages: list[str] = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text() or ""
                    pages.append(extracted)
            return "\n".join(pages), len(pages)
        except Exception as exc:
            logger.warning("pdfplumber_error", extra={"error": str(exc)})
            return "", 0

    # ------------------------------------------------------------------
    def extract_with_ocr(self, file_path: str) -> str:
        """Render each page as an image and run pytesseract on it."""
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
        import io

        doc = fitz.open(file_path)
        texts: list[str] = []
        for page in doc:
            mat = fitz.Matrix(2.0, 2.0)  # 2× zoom for better OCR quality
            pix = page.get_pixmap(matrix=mat)  # type: ignore[attr-defined]
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            texts.append(pytesseract.image_to_string(img))
        doc.close()
        return "\n".join(texts)

    # ------------------------------------------------------------------
    def is_scanned_pdf(self, file_path: str) -> bool:
        """Heuristic: average chars/page < threshold → scanned."""
        text, page_count = self._extract_with_pymupdf(file_path)
        return self._is_low_text(text, page_count)

    def _is_low_text(self, text: str, page_count: int) -> bool:
        if page_count == 0:
            return True
        return (len(text) / page_count) < _SCANNED_THRESHOLD
