"""
Deterministic retrieval layer for Azure AI Search.

Goal: always return structured sources with chunk data for frontend highlighting,
without relying on LLM formatting.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

from langchain_community.retrievers import AzureAISearchRetriever

from config import (
    AZURE_SEARCH_ENDPOINT,
    AZURE_SEARCH_KEY,
    AZURE_SEARCH_INDEX,
)


@dataclass(frozen=True)
class RetrievedChunk:
    title: str
    url: str
    chunk_id: str
    page: Optional[int]
    text: str
    score: Optional[float] = None


def _service_name_from_endpoint(endpoint: str) -> str:
    # endpoint example: https://<service>.search.windows.net
    return endpoint.split("//")[1].split(".")[0]


def _norm_url(url: str) -> str:
    # Strip query params/fragments for stable matching/deduping.
    if not url:
        return ""
    return url.split("?", 1)[0].split("#", 1)[0].strip()


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def _extract_chunk(doc: Any) -> Optional[RetrievedChunk]:
    md = getattr(doc, "metadata", {}) or {}

    title = (md.get("title") or md.get("file_name") or md.get("filename") or md.get("name") or "").strip()
    url = _norm_url(md.get("metadata_storage_path") or md.get("metadata_url") or md.get("storage_path") or md.get("url") or "")
    if not title and url:
        # last resort: filename from URL path
        try:
            title = urlparse(url).path.split("/")[-1] or ""
        except Exception:
            title = ""

    if not url and not title:
        return None

    chunk_id = str(md.get("chunk_id") or md.get("id") or "chunk_1")
    page = _safe_int(md.get("page_number") or md.get("page") or md.get("metadata_storage_page_number"))
    score = md.get("@search.score") or md.get("score")
    try:
        score = float(score) if score is not None else None
    except Exception:
        score = None

    text = getattr(doc, "page_content", "") or ""

    return RetrievedChunk(
        title=title or "Unknown source",
        url=url,
        chunk_id=chunk_id,
        page=page,
        text=text,
        score=score,
    )


def retrieve_chunks(
    query: str,
    *,
    top_k: int = 8,
) -> List[RetrievedChunk]:
    """
    Retrieve raw chunks from the main Azure AI Search index.
    """
    if not AZURE_SEARCH_ENDPOINT or not AZURE_SEARCH_KEY or not AZURE_SEARCH_INDEX:
        raise RuntimeError("Azure AI Search configuration missing (AZURE_SEARCH_ENDPOINT/KEY/INDEX).")

    retriever = AzureAISearchRetriever(
        service_name=_service_name_from_endpoint(AZURE_SEARCH_ENDPOINT),
        index_name=AZURE_SEARCH_INDEX,
        api_key=AZURE_SEARCH_KEY,
        content_key="chunk",
        top_k=top_k,
    )

    docs = retriever.invoke(query) or []
    chunks: List[RetrievedChunk] = []
    for d in docs:
        c = _extract_chunk(d)
        if c and c.text:
            chunks.append(c)
    return chunks


def chunks_to_sources(
    chunks: List[RetrievedChunk],
    *,
    max_chunks_per_source: int = 3,
) -> List[Dict[str, Any]]:
    """
    Group retrieved chunks by document URL (or title) into sources compatible with `format_sources_for_display`.

    Returns source objects like:
      { id, title, url, type, domain, chunk_data, chunks }
    """
    by_key: Dict[str, List[RetrievedChunk]] = {}
    for c in chunks:
        key = _norm_url(c.url) or c.title.lower()
        by_key.setdefault(key, []).append(c)

    sources: List[Dict[str, Any]] = []
    for i, (_key, group) in enumerate(by_key.items(), 1):
        # Prefer best scored chunks first when available
        group_sorted = sorted(group, key=lambda x: (x.score is None, -(x.score or 0.0)))
        selected = group_sorted[:max_chunks_per_source]

        first = selected[0]
        url = _norm_url(first.url)
        title = first.title

        chunk_dicts = [
            {"chunk_id": c.chunk_id, "page": c.page, "text": c.text}
            for c in selected
        ]

        sources.append(
            {
                "id": f"source_{i}",
                "title": title,
                "url": url,
                "domain": urlparse(url).netloc if url else "",
                "type": "Internal Document",
                # Backward compat
                "chunk_data": chunk_dicts[0],
                # Multi-chunk support
                "chunks": chunk_dicts,
            }
        )

    return sources


def retrieve_sources_with_chunks(
    query: str,
    *,
    top_k: int = 8,
    max_chunks_per_source: int = 3,
) -> List[Dict[str, Any]]:
    """
    High-level helper: retrieve chunks and return grouped sources with chunk_data/chunks.
    """
    chunks = retrieve_chunks(query, top_k=top_k)
    return chunks_to_sources(chunks, max_chunks_per_source=max_chunks_per_source)


