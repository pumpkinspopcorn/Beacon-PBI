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
    
    # Pattern 2: Extract "Sources:" sections with format: [1] "Title" - URL or [1] "Title" - Type
    # This matches both internet_agent and rag_agent/community_agent output formats
    # Also capture URLs that appear after source lines (URL: https://...)
    sources_section_pattern = r'\*\*Sources:\*\*\s*\n((?:\[\d+\][^\n]+\n?(?:URL:\s*[^\n]+\n?)?)+)'
    sources_match = re.search(sources_section_pattern, response_text, re.MULTILINE | re.IGNORECASE)
    
    if sources_match:
        sources_text = sources_match.group(1)
        # Remove the entire sources section (including URLs) from the main response
        cleaned_response = re.sub(r'\*\*Sources:\*\*\s*\n(?:\[\d+\][^\n]+\n?(?:URL:\s*[^\n]+\n?)?)+', '', cleaned_response, flags=re.MULTILINE | re.IGNORECASE).strip()
        
        # Parse individual source lines: [1] "Title" - URL or [1] "Title" - Type
        # First try to match URLs
        source_line_pattern_url = r'\[(\d+)\]\s*"([^"]+)"\s*-\s*(https?://[^\s]+)'
        source_matches_url = re.findall(source_line_pattern_url, sources_text)
        
        for num, title, url in source_matches_url:
            source = {
                "id": f"source_{num}",
                "title": title.strip(),
                "url": url.strip(),
                "domain": urlparse(url).netloc,
                "type": "web"
            }
            sources.append(source)
        
        # Then try to match file/document types (Internal Document, Community Discussion, etc.)
        # Also check for URLs on the next line (URL: https://...)
        source_line_pattern_file = r'\[(\d+)\]\s*"([^"]+)"\s*-\s*([^http\n][^\n]*)'
        source_matches_file = re.findall(source_line_pattern_file, sources_text)
        
        for num, title, doc_type in source_matches_file:
            # Skip if already added as URL
            if any(s.get('id') == f"source_{num}" for s in sources):
                continue
            
            # Check if there's a URL on the next line for this source
            # Pattern: [num] ... followed by URL: https://... (can be on same line or next line)
            # Look for URL: pattern after this source line
            url_pattern = rf'\[{num}\][^\n]*(?:\n[^\[]*)?URL:\s*(https?://[^\s\n\[\]]+)'
            url_match = re.search(url_pattern, sources_text, re.MULTILINE | re.IGNORECASE | re.DOTALL)
            blob_url = None
            if url_match:
                blob_url = url_match.group(1).strip()
            
            source = {
                "id": f"source_{num}",
                "title": title.strip(),
                "type": "file",
                "doc_type": doc_type.strip(),  # e.g., "Internal Document", "Community Discussion"
            }
            
            # Add URL if found
            if blob_url and blob_url != 'URL not available':
                source["url"] = blob_url
                source["path"] = blob_url  # Also set path for frontend compatibility
            
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
    
    # Clean up extra whitespace and newlines
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
    
    return display_sources

def clean_response_text(response_text: str) -> str:
    """
    Clean response text by removing source citations and references.
    This ensures the main response doesn't contain redundant source information.
    """
    cleaned_text, _, _ = extract_sources_and_citations(response_text)
    return cleaned_text