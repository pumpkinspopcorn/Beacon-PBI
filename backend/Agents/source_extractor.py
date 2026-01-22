"""
Source and citation extraction utilities.
Extracts sources and citations from agent responses and cleans the main response.
"""

import re
import base64
from typing import List, Dict, Tuple
from urllib.parse import urlparse


def extract_sources_and_citations(response_text: str) -> Tuple[str, List[Dict], List[Dict]]:
    """
    Extract sources and citations from agent response text.
    
    Returns:
        Tuple of (cleaned_response, sources, citations)
    """
    sources = []
    citations = []
    cleaned_response = response_text
    
    # Pattern 1: Extract markdown links [text](url)
    markdown_link_pattern = r'\[([^\]]+)\]\((https?://[^\)]+)\)'
    markdown_matches = re.findall(markdown_link_pattern, response_text)
    
    for text, url in markdown_matches:
        citation = {
            "id": f"cite_{len(citations) + 1}",
            "text": text,
            "url": url,
            "domain": urlparse(url).netloc,
            "type": "web"
        }
        citations.append(citation)
    
    # Pattern 2: Extract "Sources:" sections with SOURCE_START/SOURCE_END markers
    source_marker_pattern = r'SOURCE_START\s*\n\s*title:\s*([^\n\r]+?)\s*\n+\s*url:\s*(https?://[^\n\r]+?)\s*\n+\s*type:\s*([^\n\r]+?)\s*\n+SOURCE_END'
    source_marker_matches = re.findall(source_marker_pattern, response_text, re.MULTILINE | re.IGNORECASE)
    
    if source_marker_matches:
        print(f"[SourceExtractor] Found {len(source_marker_matches)} SOURCE_START blocks")
        cleaned_response = re.sub(r'\*\*Sources:\*\*.*?(?=transfer_to_agent|$)', '', cleaned_response, flags=re.DOTALL | re.IGNORECASE).strip()
        cleaned_response = re.sub(r'SOURCE_START.*?SOURCE_END', '', cleaned_response, flags=re.DOTALL | re.IGNORECASE).strip()
        
        for i, (title, url, doc_type) in enumerate(source_marker_matches, 1):
            url = re.sub(r'\s+', '', url.strip())
            
            source = {
                "id": f"source_{i}",
                "title": title.strip(),
                "url": url,
                "domain": urlparse(url).netloc if url.startswith('http') else "",
                "type": doc_type.strip() if doc_type else "web"
            }
            
            print(f"[SourceExtractor] Extracted source {i}: {source['title']} ({source['type']})")
            sources.append(source)
    
    # Pattern 3: Extract tool output sources (simplified - no CHUNK_META)
    # This pattern is now just for backward compatibility
    if not sources:
        tool_source_pattern = (
            r'^\s*\d+\.\s*Source:\s*(?P<title>.+?)\s*'
            r'(?:\([^\)]*\))?\s*\n+'
            r'\s*URL:\s*(?P<url>https?://[^\s\n]+)'
        )
        tool_matches = list(re.finditer(tool_source_pattern, response_text, re.MULTILINE | re.IGNORECASE))
        if tool_matches:
            print(f"[SourceExtractor] Found {len(tool_matches)} tool-output sources")
            for i, m in enumerate(tool_matches, 1):
                title = (m.group('title') or '').strip()
                url = re.sub(r'\s+', '', (m.group('url') or '').strip())

                source = {
                    "id": f"source_{i}",
                    "title": title,
                    "url": url,
                    "domain": urlparse(url).netloc if url.startswith('http') else "",
                    "type": "Internal Document"
                }
                print(f"[SourceExtractor] Extracted tool source {i}: {title}")
                sources.append(source)
    
    # Pattern 4: Extract "Sources:" sections with [1] "Title" - Type format
    if not sources:
        sources_section_pattern = r'\*\*Sources:\*\*\s*\n((?:\s*\[\d+\][^\n]+\n+(?:URL:\s*[^\n]+\n*)?)+)'
        sources_match = re.search(sources_section_pattern, response_text, re.MULTILINE | re.IGNORECASE)
        
        if sources_match:
            sources_text = sources_match.group(1)
            cleaned_response = re.sub(r'\*\*Sources:\*\*\s*\n(?:\s*\[\d+\][^\n]+\n+(?:URL:\s*[^\n]+\n*)?)+', '', cleaned_response, flags=re.MULTILINE | re.IGNORECASE).strip()
            
            source_block_pattern = r'\[(\d+)\]\s*"([^"]+)"\s*-\s*([^\n]+)\s*\n+\s*URL:\s*(https?://[^\s\n]+)'
            source_blocks = re.findall(source_block_pattern, sources_text, re.MULTILINE)
            
            for num, title, doc_type, url in source_blocks:
                source = {
                    "id": f"source_{num}",
                    "title": title.strip(),
                    "url": url.strip(),
                    "domain": urlparse(url).netloc,
                    "type": "web"
                }
                sources.append(source)
    
    # Clean up the response text
    cleaned_response = re.sub(r'\n\s*URL:\s*https?://[^\s\n]+', '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE)
    cleaned_response = re.sub(r'\s*transfer_to_agent\([^)]+\)\s*', '', cleaned_response, flags=re.IGNORECASE)
    cleaned_response = re.sub(r'\s*\[\d+\]\s*', ' ', cleaned_response)
    cleaned_response = re.sub(r'\s+', ' ', cleaned_response)
    cleaned_response = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_response)
    cleaned_response = cleaned_response.strip()
    
    return cleaned_response, sources, citations


def format_sources_for_display(sources: List[Dict], citations: List[Dict]) -> List[Dict]:
    """
    Format sources and citations for frontend display.
    Deduplicates sources by URL/title.
    """
    display_sources = []
    seen_keys = {}
    
    print(f"[format_sources_for_display] Processing {len(sources)} sources, {len(citations)} citations")
    
    def _source_key(source: Dict) -> str:
        """Generate unique key for source deduplication."""
        url = (source.get('url') or source.get('path') or '').split('?')[0].strip().lower()
        title = (source.get('title') or source.get('name') or '').strip().lower()
        return url or title
    
    # Add citations (web links)
    for citation in citations:
        display_sources.append({
            "id": citation["id"],
            "name": citation["text"],
            "path": citation["url"],
            "type": "web",
            "domain": citation.get("domain", ""),
            "clickable": True
        })
    
    # Add sources, deduplicating
    for source in sources:
        key = _source_key(source)
        if not key:
            continue
        
        # Skip if already seen
        if key in seen_keys:
            print(f"[format_sources_for_display] Skipping duplicate: {source.get('title')}")
            continue
        
        print(f"[format_sources_for_display] Adding source: {source.get('title')} (type={source.get('type')})")
        
        # Format and add
        formatted = _format_single_source(source)
        seen_keys[key] = len(display_sources)
        display_sources.append(formatted)
    
    return display_sources


def _format_single_source(source: Dict) -> Dict:
    """Format a single source for display (no chunks)."""
    source_type = source.get("type", "file")
    
    if source_type == "file":
        display_source = {
            "id": source.get("id", "unknown"),
            "name": source.get("title", "Unknown Source"),
            "type": source.get("doc_type", "file"),
            "clickable": False
        }
        if source.get("url") or source.get("path"):
            display_source["path"] = source.get("url") or source.get("path")
            display_source["clickable"] = True
        return display_source
    
    elif source_type == "web" and source.get("url"):
        return {
            "id": source.get("id", "unknown"),
            "name": source.get("title", "Unknown Source"),
            "path": source["url"],
            "type": "web",
            "domain": source.get("domain", ""),
            "clickable": True
        }
    
    else:
        # Handle any other type (e.g., "Internal Document")
        if source.get("url") or source.get("path"):
            display_source = {
                "id": source.get("id", "unknown"),
                "name": source.get("title", "Unknown Source"),
                "path": source.get("url") or source.get("path"),
                "type": source_type,
                "clickable": True
            }
            if source.get("domain"):
                display_source["domain"] = source["domain"]
            return display_source
    
    # Fallback
    return {
        "id": source.get("id", "unknown"),
        "name": source.get("title", "Unknown Source"),
        "type": source_type,
        "clickable": False
    }


def clean_response_text(response_text: str) -> str:
    """
    Clean response text by removing source citations and references.
    """
    cleaned_text, _, _ = extract_sources_and_citations(response_text)
    return cleaned_text
