"""Search input sanitization helpers."""

import re
from typing import Any


MOJIBAKE_MARKERS = ("澶", "鍨", "嬪", "紑", "瀹", "炰", "範", "鐩", "鍚")


def _looks_like_utf8_as_gbk_mojibake(text: str) -> bool:
    return any(marker in text for marker in MOJIBAKE_MARKERS)


def _repair_utf8_as_gbk_mojibake(text: str) -> str:
    if not _looks_like_utf8_as_gbk_mojibake(text):
        return text

    try:
        repaired = text.encode("gbk", errors="ignore").decode("utf-8", errors="ignore")
    except UnicodeError:
      return text

    repaired = re.sub(r"开(?=\s|$)", "开发", repaired)
    return repaired if len(repaired) >= max(2, len(text) // 3) else text


def sanitize_search_text(value: Any) -> str:
    """Return text that is safe to encode into a URL query parameter."""
    if value is None:
        return ""

    text = str(value)
    text = "".join(ch for ch in text if not 0xD800 <= ord(ch) <= 0xDFFF)
    text = _repair_utf8_as_gbk_mojibake(text)
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"实$", "实习", text)
