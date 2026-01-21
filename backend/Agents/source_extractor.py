"""
Source and citation extraction utilities.
Extracts sources and citations from agent responses and cleans the main response.
"""

import re
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
    
    # Pattern 2: Extract "Sources:" sections with SOURCE_START/SOURCE_END markers (new format)
    # Format: SOURCE_START\ntitle: ...\nurl: ...\ntype: ...\nSOURCE_END
    # More flexible pattern that handles variations in whitespace, blank lines, and optional type
    # Pattern allows for optional blank lines between fields
    # URL pattern allows any characters except newlines (we'll clean whitespace later)
    source_marker_pattern = r'SOURCE_START\s*\n\s*title:\s*([^\n\r]+?)\s*\n+\s*url:\s*(https?://[^\n\r]+?)\s*\n+\s*(?:type:\s*([^\n\r]+?)\s*\n+)?SOURCE_END'
    source_marker_matches = re.findall(source_marker_pattern, response_text, re.MULTILINE | re.IGNORECASE)
    
    if source_marker_matches:
        print(f"[SourceExtractor] Found {len(source_marker_matches)} SOURCE_START blocks")
        # Remove the entire sources section from the cleaned response
        cleaned_response = re.sub(r'\*\*Sources:\*\*.*?(?=transfer_to_agent|$)', '', cleaned_response, flags=re.DOTALL | re.IGNORECASE).strip()
        # Also remove SOURCE_START blocks from cleaned response
        cleaned_response = re.sub(r'SOURCE_START.*?SOURCE_END', '', cleaned_response, flags=re.DOTALL | re.IGNORECASE).strip()
        
        for i, (title, url, doc_type) in enumerate(source_marker_matches, 1):
            # Clean up URL (remove trailing whitespace/newlines)
            url = url.strip()
            # Handle URLs that might have been split across lines
            url = re.sub(r'\s+', '', url)
            
            source = {
                "id": f"source_{i}",
                "title": title.strip(),
                "url": url,
                "domain": urlparse(url).netloc if url.startswith('http') else "",
                "type": doc_type.strip() if doc_type else "web"
            }
            print(f"[SourceExtractor] Extracted source {i}: {source['title']} ({source['type']})")
            sources.append(source)
    
    # Pattern 2b: Extract "Sources:" sections with format: [1] "Title" - URL or [1] "Title" - Type (old format)
    # This matches both internet_agent and rag_agent/community_agent output formats
    # Also capture URLs that appear after source lines (URL: https://...)
    # IMPORTANT: Search in original response_text, not cleaned_response
    # Handle blank lines between sources (\n\n)
    if not sources:
        sources_section_pattern = r'\*\*Sources:\*\*\s*\n((?:\s*\[\d+\][^\n]+\n+(?:URL:\s*[^\n]+\n*)?)+)'
        sources_match = re.search(sources_section_pattern, response_text, re.MULTILINE | re.IGNORECASE)
        
        if sources_match:
            sources_text = sources_match.group(1)
            # Remove the entire sources section (including URLs) from the main response
            # This regex removes **Sources:** and everything after it until transfer_to_agent or end of string
            cleaned_response = re.sub(r'\*\*Sources:\*\*\s*\n(?:\s*\[\d+\][^\n]+\n+(?:URL:\s*[^\n]+\n*)?)+', '', cleaned_response, flags=re.MULTILINE | re.IGNORECASE).strip()
            
            # Parse individual source lines: [1] "Title" - Type followed by URL: https://... on next line
            # Format: [1] "Title" - Link\nURL: https://... or [1] "Title" - Collider\nURL: https://...
            # We need to match each [num] block including its URL line
            # Handle optional extra newlines between source number and URL
            source_block_pattern = r'\[(\d+)\]\s*"([^"]+)"\s*-\s*([^\n]+)\s*\n+\s*URL:\s*(https?://[^\s\n]+)'
            source_blocks = re.findall(source_block_pattern, sources_text, re.MULTILINE)
            
            for num, title, doc_type, url in source_blocks:
                source = {
                    "id": f"source_{num}",
                    "title": title.strip(),
                    "url": url.strip(),
                    "domain": urlparse(url).netloc,
                    "type": "web"  # Internet sources are web type
                }
                sources.append(source)
    
    # Pattern 2c: Handle inline sources format (when agent doesn't follow proper formatting)
    # Format: **Sources:** "Title" - Link URL: https://... "Title2" - Link URL: https://...
    # This is a fallback for when the agent puts everything on one or few lines without [1], [2] numbering
    if not sources:
        inline_sources_pattern = r'\*\*Sources:\*\*\s*(.+?)(?:transfer_to_agent|$)'
        inline_match = re.search(inline_sources_pattern, response_text, re.DOTALL | re.IGNORECASE)
        
        if inline_match:
            sources_text = inline_match.group(1)
            # Remove the entire sources section from the main response
            cleaned_response = re.sub(r'\*\*Sources:\*\*\s*.+?(?=transfer_to_agent|$)', '', cleaned_response, flags=re.DOTALL | re.IGNORECASE).strip()
            
            # Extract inline sources: "Title" - Link URL: https://...
            # Pattern matches: "Title" - Link URL: https://url or "Title" - Link\nURL: https://url
            inline_source_pattern = r'"([^"]+)"\s*-\s*Link\s*(?:\n\s*)?URL:\s*(https?://[^\s]+)'
            inline_matches = re.findall(inline_source_pattern, sources_text, re.IGNORECASE)
            
            for i, (title, url) in enumerate(inline_matches, 1):
                source = {
                    "id": f"source_{i}",
                    "title": title.strip(),
                    "url": url.strip(),
                    "domain": urlparse(url).netloc,
                    "type": "web"
                }
                sources.append(source)
    
    # Pattern 3: Fallback - Extract "Sources:" sections (more flexible matching for other formats)
    if not sources:
        sources_pattern = r'(?:Sources?|References?):\s*\n((?:(?:\d+\.|\-|\*)\s*[^\n]+(?:\n|$))+)'
        sources_match = re.search(sources_pattern, response_text, re.IGNORECASE | re.MULTILINE)
        
        if sources_match:
            sources_text = sources_match.group(1)
            # Remove the entire sources section from the main response
            cleaned_response = re.sub(sources_pattern, '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE).strip()
            
            # Parse individual source lines
            source_lines = re.findall(r'(?:\d+\.|\-|\*)\s*([^\n]+)', sources_text)
            for i, source_line in enumerate(source_lines):
                source_line = source_line.strip()
                if not source_line:
                    continue
                    
                # Check if the source line contains a markdown link
                markdown_match = re.search(r'\[([^\]]+)\]\((https?://[^\)]+)\)', source_line)
                if markdown_match:
                    title, url = markdown_match.groups()
                    source = {
                        "id": f"source_{len(sources) + 1}",
                        "title": title.strip(),
                        "url": url,
                        "domain": urlparse(url).netloc,
                        "type": "web"
                    }
                else:
                    # Check if the source line contains a plain URL
                    url_match = re.search(r'(https?://[^\s]+)', source_line)
                    if url_match:
                        url = url_match.group(1)
                        title = re.sub(r'\s*-?\s*https?://[^\s]+', '', source_line).strip()
                        source = {
                            "id": f"source_{len(sources) + 1}",
                            "title": title or f"Source {i + 1}",
                            "url": url,
                            "domain": urlparse(url).netloc,
                            "type": "web"
                        }
                    else:
                        # File reference or document name without URL
                        source = {
                            "id": f"source_{len(sources) + 1}",
                            "title": source_line.strip(),
                            "type": "file"
                        }
                sources.append(source)
    
    # Pattern 4: Extract file references like [filename.pdf] or "filename.pdf"
    file_pattern = r'(?:\[([^\]]+\.[a-zA-Z]{2,4})\]|"([^"]+\.[a-zA-Z]{2,4})")'
    file_matches = re.findall(file_pattern, response_text)
    
    for match in file_matches:
        filename = match[0] or match[1]
        if filename and not any(s.get('title') == filename for s in sources):
            source = {
                "id": f"source_{len(sources) + 1}",
                "title": filename,
                "type": "file"
            }
            sources.append(source)
    
    # Pattern 5: Extract "According to [source]" patterns
    according_pattern = r'According to ([^,\n]+),'
    according_matches = re.findall(according_pattern, response_text, re.IGNORECASE)
    
    for source_text in according_matches:
        # Skip if it's a markdown link (already handled)
        if '[' in source_text and '](' in source_text:
            continue
        # Check if it's a file reference
        if '.' in source_text and not source_text.startswith('http'):
            if not any(s.get('title') == source_text.strip() for s in sources):
                source = {
                    "id": f"source_{len(sources) + 1}",
                    "title": source_text.strip(),
                    "type": "file"
                }
                sources.append(source)
    
    # Extract standalone URLs from answer text that might be blob URLs for documents
    # Pattern: "URL: https://..." (usually appears after answer, before sources)
    standalone_url_pattern = r'URL:\s*(https?://[^\s\n]+)'
    standalone_urls = re.findall(standalone_url_pattern, response_text, re.IGNORECASE | re.MULTILINE)
    
    # Extract chunk metadata: CHUNK_META: chunk_id=xxx|page=xxx|text_b64=xxx
    chunk_meta_pattern = r'CHUNK_META:\s*chunk_id=([^|]+)\|page=([^|]+)\|text_b64=([^\s\n]+)'
    chunk_metas = re.findall(chunk_meta_pattern, response_text, re.IGNORECASE | re.MULTILINE)
    
    # If we found standalone URLs and have sources, try to match them
    # Usually the first URL corresponds to the first source, etc.
    if standalone_urls and sources:
        for idx, url in enumerate(standalone_urls):
            if idx < len(sources) and not sources[idx].get('url') and not sources[idx].get('path'):
                sources[idx]['url'] = url
                sources[idx]['path'] = url
    
    # Add chunk data to sources for highlighting
    if chunk_metas and sources:
        import base64
        for idx, (chunk_id, page, text_b64) in enumerate(chunk_metas):
            if idx < len(sources):
                try:
                    # Decode base64 text
                    chunk_text = base64.b64decode(text_b64).decode('utf-8')
                    page_num = None if page == 'null' else int(page)
                    sources[idx]['chunk_data'] = {
                        'chunk_id': chunk_id,
                        'page': page_num,
                        'text': chunk_text
                    }
                except Exception as e:
                    print(f"Error decoding chunk data: {e}")
                    pass  # Skip if decoding fails
    
    # Clean up the response text - remove citation markers and clean formatting
    # Remove standalone URLs that are now in citations
    for _, url in markdown_matches:
        cleaned_response = cleaned_response.replace(url, '')
    
    # Remove standalone "URL: https://..." lines that might appear in the answer
    # These should have been extracted to sources, so remove them from the answer
    cleaned_response = re.sub(r'\n\s*URL:\s*https?://[^\s\n]+', '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE)
    
    # Remove CHUNK_META lines from the cleaned response
    cleaned_response = re.sub(r'\n\s*CHUNK_META:\s*[^\n]+', '', cleaned_response, flags=re.IGNORECASE | re.MULTILINE)
    
    # Remove transfer_to_agent() calls that might appear at the end
    cleaned_response = re.sub(r'\s*transfer_to_agent\([^)]+\)\s*$', '', cleaned_response, flags=re.IGNORECASE)
    
    # Remove any citation numbers like [1], [2], [3] from the answer text
    # These should only appear in the Sources section (which we've already removed), not in the answer
    # Do this AFTER extracting sources so we don't break the source extraction
    cleaned_response = re.sub(r'\s*\[\d+\]\s*', ' ', cleaned_response)
    
    # Clean up extra whitespace and newlines
    cleaned_response = re.sub(r'\s+', ' ', cleaned_response)  # Clean up extra spaces
    cleaned_response = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_response)
    cleaned_response = cleaned_response.strip()
    
    return cleaned_response, sources, citations

def format_sources_for_display(sources: List[Dict], citations: List[Dict]) -> List[Dict]:
    """
    Format sources and citations for frontend display.
    Combines both into a unified list with proper formatting.
    """
    display_sources = []
    
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
    
    # Add sources (both file and web)
    for source in sources:
        if source["type"] == "file":
            display_source = {
                "id": source["id"],
                "name": source["title"],
                "type": source.get("doc_type", "file"),  # Use doc_type if available (e.g., "Internal Document")
                "clickable": False
            }
            # If file has a URL (blob storage), add it for document viewing
            if source.get("url") or source.get("path"):
                display_source["path"] = source.get("url") or source.get("path")
                display_source["clickable"] = True
            # Add chunk data for highlighting if available
            if source.get("chunk_data"):
                display_source["chunk_data"] = source["chunk_data"]
            display_sources.append(display_source)
        elif source["type"] == "web" and source.get("url"):
            display_sources.append({
                "id": source["id"],
                "name": source["title"],
                "path": source["url"],
                "type": "web",
                "domain": source.get("domain", ""),
                "clickable": True
            })
        else:
            # Handle any other type (e.g., "Internal Document", "Collider", etc.) that has a URL
            if source.get("url") or source.get("path"):
                display_source = {
                    "id": source["id"],
                    "name": source["title"],
                    "path": source.get("url") or source.get("path"),
                    "type": source["type"],
                    "clickable": True
                }
                if source.get("domain"):
                    display_source["domain"] = source["domain"]
                if source.get("chunk_data"):
                    display_source["chunk_data"] = source["chunk_data"]
                display_sources.append(display_source)
    
    return display_sources

def clean_response_text(response_text: str) -> str:
    """
    Clean response text by removing source citations and references.
    This ensures the main response doesn't contain redundant source information.
    """
    cleaned_text, _, _ = extract_sources_and_citations(response_text)
    return cleaned_text