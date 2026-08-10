"""
Plain-text and Markdown extractor.
Markdown files have their syntax stripped to produce clean plain text.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_CHARS_PER_PAGE_ESTIMATE = 3000

# Regex patterns for stripping common Markdown constructs
_MD_PATTERNS: list[tuple[str, str]] = [
    (r"^#{1,6}\s+", ""),        # ATX headings
    (r"\*{1,2}(.+?)\*{1,2}", r"\1"),  # bold / italic
    (r"_{1,2}(.+?)_{1,2}", r"\1"),    # alt bold / italic
    (r"`{1,3}[^`]*`{1,3}", ""),       # inline code / code fences
    (r"^```.*$", ""),                  # fenced code block delimiters
    (r"^\s*[-*+]\s+", ""),            # unordered list bullets
    (r"^\s*\d+\.\s+", ""),           # ordered list numbers
    (r"\[([^\]]+)\]\([^\)]*\)", r"\1"),  # links → link text
    (r"!\[([^\]]*)\]\([^\)]*\)", ""),    # images
    (r"^>\s+", ""),                      # block-quotes
    (r"^[-*_]{3,}$", ""),               # horizontal rules
    (r"\|.*\|", ""),                    # table rows (simple strip)
    (r"\n{3,}", "\n\n"),               # collapse excessive blank lines
]


class TextProcessor:
    def extract_text(self, file_path: str) -> tuple[str, int]:
        """
        Return *(text, page_estimate)*.
        Markdown files have their syntax stripped.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        raw = path.read_text(encoding="utf-8", errors="replace")

        if path.suffix.lower() in {".md", ".markdown"}:
            text = self._strip_markdown(raw)
        else:
            text = raw

        page_estimate = max(1, round(len(text) / _CHARS_PER_PAGE_ESTIMATE))
        return text, page_estimate

    # ------------------------------------------------------------------
    def _strip_markdown(self, text: str) -> str:
        for pattern, replacement in _MD_PATTERNS:
            text = re.sub(pattern, replacement, text, flags=re.MULTILINE)
        return text.strip()
