from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader

MAX_PREVIEW_CHARS = 4000
MAX_LLM_SOURCE_CHARS = 60000
MAX_PDF_PAGES = 40


@dataclass(frozen=True)
class DocumentText:
    content_preview: str | None
    llm_source_text: str | None
    page_count: int | None = None


def extract_document_preview(
    file_name: str,
    content_type: str,
    content: bytes,
) -> str | None:
    return extract_document_text(file_name, content_type, content).content_preview


def extract_document_text(
    file_name: str,
    content_type: str,
    content: bytes,
) -> DocumentText:
    if _is_pdf(file_name, content_type):
        return _extract_pdf_text(content)

    if _is_text(file_name, content_type):
        cleaned_text = _clean_text(content.decode("utf-8", errors="ignore"))
        return DocumentText(
            content_preview=_truncate(cleaned_text, MAX_PREVIEW_CHARS),
            llm_source_text=_truncate(cleaned_text, MAX_LLM_SOURCE_CHARS),
        )

    return DocumentText(content_preview=None, llm_source_text=None)


def _extract_pdf_text(content: bytes) -> DocumentText:
    try:
        reader = PdfReader(BytesIO(content))
        page_text = [page.extract_text() or "" for page in reader.pages[:MAX_PDF_PAGES]]
    except Exception:
        return DocumentText(content_preview=None, llm_source_text=None)

    cleaned_text = _clean_text(" ".join(page_text))
    return DocumentText(
        content_preview=_truncate(cleaned_text, MAX_PREVIEW_CHARS),
        llm_source_text=_truncate(cleaned_text, MAX_LLM_SOURCE_CHARS),
        page_count=len(reader.pages),
    )


def _is_pdf(file_name: str, content_type: str) -> bool:
    return content_type == "application/pdf" or file_name.lower().endswith(".pdf")


def _is_text(file_name: str, content_type: str) -> bool:
    return content_type.startswith("text/") or file_name.lower().endswith(
        (".txt", ".csv", ".json", ".md")
    )


def _clean_text(value: str) -> str | None:
    normalized = " ".join(value.split())
    if not normalized:
        return None

    return normalized


def _truncate(value: str | None, max_chars: int) -> str | None:
    if not value:
        return None

    return value[:max_chars]
