import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChunkData } from '@/types/powerbi-chat';
import { safeProcessChunks } from '@/lib/chunkUtils';
import { normalizeText } from '@/lib/textMatcher';

interface TextViewerWithHighlightProps {
  url: string;
  chunks?: ChunkData[];
  title: string;
}

/**
 * TextViewerWithHighlight - Displays text files with chunk highlighting
 * Similar to PDFViewerWithHighlight but for plain text files
 */
export const TextViewerWithHighlight: React.FC<TextViewerWithHighlightProps> = ({
  url,
  chunks: chunksProp,
  title,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // Process chunks safely
  const finalChunks = useMemo(() => {
    const processed = safeProcessChunks(chunksProp);
    console.log(`[TextViewer] Using ${processed.length} chunks for highlighting:`, processed);
    return processed;
  }, [chunksProp]);

  // Fetch text content through proxy
  useEffect(() => {
    const fetchText = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the API proxy to fetch the document
        const proxyUrl = `/api/document-proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch text file: ${response.statusText}`);
        }

        const text = await response.text();
        setTextContent(text);
      } catch (err) {
        console.error('[TextViewer] Error fetching text:', err);
        setError(err instanceof Error ? err.message : 'Failed to load text file');
      } finally {
        setLoading(false);
      }
    };

    fetchText();
  }, [url]);

  // Get current chunk text
  const currentChunk = finalChunks[currentChunkIndex];

  // Find and highlight chunks in the text
  const highlightedContent = useMemo(() => {
    if (!textContent || finalChunks.length === 0) {
      return textContent;
    }

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a map of positions to highlight
    const highlights: { start: number; end: number; chunkIndex: number }[] = [];

    finalChunks.forEach((chunk, index) => {
      if (!chunk.text) return;

      // Robust matching: allow whitespace differences between chunk text and document text
      // (common when text was extracted/normalized server-side).
      const normalizedChunk = normalizeText(chunk.text);
      if (!normalizedChunk) return;

      // Build a whitespace-flexible regex: word1\s+word2\s+... (case-insensitive)
      // Keep it bounded to avoid pathological regex sizes on huge chunks.
      const chunkParts = normalizedChunk.split(/\s+/).slice(0, 200);
      if (chunkParts.length === 0) return;

      const pattern = chunkParts.map(escapeRegex).join('\\s+');

      try {
        const re = new RegExp(pattern, 'gi');
        let match: RegExpExecArray | null;
        while ((match = re.exec(textContent)) !== null) {
          // Guard against zero-length matches to avoid infinite loops
          if (match[0].length === 0) {
            re.lastIndex += 1;
            continue;
          }
        highlights.push({
            start: match.index,
            end: match.index + match[0].length,
          chunkIndex: index,
        });
        }
      } catch (e) {
        // Fallback: simple normalized contains (no highlighting if we can't locate a range)
        const contentNorm = normalizeText(textContent).toLowerCase();
        const chunkNormLower = normalizedChunk.toLowerCase();
        if (contentNorm.includes(chunkNormLower)) {
          console.warn('[TextViewer] Chunk matched after normalization but could not map highlight range:', e);
        }
      }
    });

    // Sort highlights by start position
    highlights.sort((a, b) => a.start - b.start);

    // Build highlighted HTML
    if (highlights.length === 0) {
      return textContent;
    }

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    highlights.forEach((highlight, index) => {
      // Skip/trim overlaps to keep rendering stable
      if (highlight.start < lastEnd) {
        if (highlight.end <= lastEnd) {
          return;
        }
        highlight = { ...highlight, start: lastEnd };
      }

      // Add text before highlight
      if (highlight.start > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>
            {textContent.substring(lastEnd, highlight.start)}
          </span>
        );
      }

      // Add highlighted text
      const isActive = highlight.chunkIndex === currentChunkIndex;
      parts.push(
        <mark
          key={`highlight-${index}`}
          id={highlight.chunkIndex === currentChunkIndex ? 'active-highlight' : undefined}
          className={
            isActive
              ? 'bg-yellow-300 text-black font-semibold'
              : 'bg-yellow-100 text-black'
          }
        >
          {textContent.substring(highlight.start, highlight.end)}
        </mark>
      );

      lastEnd = highlight.end;
    });

    // Add remaining text
    if (lastEnd < textContent.length) {
      parts.push(
        <span key="text-end">{textContent.substring(lastEnd)}</span>
      );
    }

    return parts;
  }, [textContent, finalChunks, currentChunkIndex]);

  // Scroll to active highlight
  useEffect(() => {
    if (finalChunks.length > 0) {
      const activeElement = document.getElementById('active-highlight');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentChunkIndex, finalChunks]);

  const handlePreviousChunk = useCallback(() => {
    setCurrentChunkIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextChunk = useCallback(() => {
    setCurrentChunkIndex((prev) => Math.min(finalChunks.length - 1, prev + 1));
  }, [finalChunks.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-slate-600">Loading text file...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            variant="outline"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Try Opening Directly
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chunk Navigation Controls */}
      {finalChunks.length > 0 && (
        <div className="flex items-center justify-between p-3 border-b bg-slate-50">
          <div className="text-sm text-slate-600">
            {currentChunk && (
              <span className="font-medium">
                Chunk {currentChunkIndex + 1} of {finalChunks.length}
                {currentChunk.page && ` • Page ${currentChunk.page}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePreviousChunk}
              disabled={currentChunkIndex === 0}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              onClick={handleNextChunk}
              disabled={currentChunkIndex >= finalChunks.length - 1}
              size="sm"
              variant="outline"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Text Content */}
      <div className="flex-1 overflow-auto p-6">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
          {highlightedContent}
        </pre>
      </div>
    </div>
  );
};

