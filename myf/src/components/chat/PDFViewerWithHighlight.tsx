import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, SkipBack, SkipForward, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';
import { findChunkOnPage, TextContent, ChunkData } from '@/lib/textMatcher';
import { 
  getChunksForPage, 
  getInitialPage, 
  clampChunkIndex, 
  truncateText, 
  safeProcessChunks,
  createPageSearchCache,
  getCachedPageSearch,
  setCachedPageSearch,
  needsAllPageSearch,
  applySearchCacheToChunks,
  PageSearchCache,
  PageSearchResult
} from '@/lib/chunkUtils';

// Set worker path to use local worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Highlight rectangle for rendering on canvas
 */
interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  chunkIndex: number;
}

interface PDFViewerWithHighlightProps {
  url: string;
  /** @deprecated Use `chunks` array instead for multi-chunk support */
  chunkData?: ChunkData;
  /** Array of chunks for multi-chunk highlighting support */
  chunks?: ChunkData[];
  title: string;
  onChunkChange?: (chunkIndex: number) => void;
}

export const PDFViewerWithHighlight: React.FC<PDFViewerWithHighlightProps> = ({
  url,
  chunkData,
  chunks: chunksProp,
  title,
  onChunkChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([]);
  
  // Multi-chunk support state
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [highlightsByPage, setHighlightsByPage] = useState<Map<number, HighlightRect[]>>(new Map());
  const [highlightsFound, setHighlightsFound] = useState<boolean>(false);
  
  // Page search cache for chunks with null page - Requirements: 6.4, 3.4
  const pageSearchCacheRef = useRef<PageSearchCache>(createPageSearchCache());
  const [searchingPages, setSearchingPages] = useState<boolean>(false);
  const [resolvedChunks, setResolvedChunks] = useState<ChunkData[]>([]);

  // Normalize chunks: support both legacy chunkData and new chunks array
  // Requirements: 6.1 - Validate chunk data structure on component mount
  // Return empty highlights for invalid data and log warnings for debugging
  const rawChunks = useMemo(() => {
    // First, try to use the new chunks array prop
    if (chunksProp !== undefined) {
      const validChunks = safeProcessChunks(chunksProp, true);
      return validChunks;
    }
    
    // Fall back to legacy chunkData prop
    if (chunkData !== undefined) {
      const validChunks = safeProcessChunks([chunkData], true);
      return validChunks;
    }
    
    return [];
  }, [chunksProp, chunkData]);

  // Use resolved chunks (with found pages) if available, otherwise use raw chunks
  // Requirements: 6.4
  const chunks = useMemo(() => {
    const finalChunks = resolvedChunks.length > 0 ? resolvedChunks : rawChunks;
    console.log(`[PDFViewer] Using ${finalChunks.length} chunks for highlighting:`, finalChunks);
    return finalChunks;
  }, [resolvedChunks, rawChunks]);

  // Get chunks for the current page using utility function
  const currentPageChunks = useMemo(() => {
    return getChunksForPage(chunks, currentPage);
  }, [chunks, currentPage]);

  // Get the current chunk based on currentChunkIndex for banner display
  // Requirements: 2.4, 5.4, 6.3
  const currentChunk = useMemo(() => {
    if (chunks.length === 0) return null;
    const validIndex = clampChunkIndex(currentChunkIndex, chunks.length);
    return chunks[validIndex];
  }, [chunks, currentChunkIndex]);

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch PDF through proxy
        const proxyUrl = `/api/document-proxy?url=${encodeURIComponent(url)}`;
        const loadingTask = pdfjsLib.getDocument(proxyUrl);
        const pdf = await loadingTask.promise;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        
        // Navigate to first chunk's page on load (if page is not null)
        // Requirements: 2.2 - uses getInitialPage utility for consistent behavior
        const initialPage = getInitialPage(rawChunks, pdf.numPages);
        setCurrentPage(initialPage);
        setCurrentChunkIndex(0);
        
        setLoading(false);
        
        // After PDF loads, search for chunks with null pages
        // Requirements: 6.4, 3.4
        await searchForNullPageChunks(pdf, rawChunks);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPDF();
  }, [url, rawChunks]);

  /**
   * Search for chunk text across all pages when chunk.page is null.
   * Caches results to avoid repeated searches.
   * 
   * Requirements: 6.4, 3.4
   */
  const searchForNullPageChunks = async (pdf: any, chunksToSearch: ChunkData[]) => {
    // Find chunks that need searching (have null page)
    const nullPageChunks = chunksToSearch.filter(needsAllPageSearch);
    
    if (nullPageChunks.length === 0) {
      // No chunks need searching, use raw chunks as-is
      setResolvedChunks(chunksToSearch);
      return;
    }
    
    setSearchingPages(true);
    const cache = pageSearchCacheRef.current;
    
    try {
      // Search for each chunk with null page
      for (const chunk of nullPageChunks) {
        // Check cache first
        const cached = getCachedPageSearch(cache, chunk.chunk_id);
        if (cached) {
          continue; // Already searched
        }
        
        // Search across all pages
        const foundPage = await searchChunkAcrossPages(pdf, chunk);
        
        // Cache the result
        const result: PageSearchResult = {
          chunkId: chunk.chunk_id,
          foundPage,
          confidence: foundPage !== null ? 1.0 : 0
        };
        setCachedPageSearch(cache, result);
      }
      
      // Apply cached results to chunks
      const updatedChunks = applySearchCacheToChunks(chunksToSearch, cache);
      setResolvedChunks(updatedChunks);
      
      // If the first chunk was null and we found a page, navigate to it
      if (updatedChunks.length > 0 && updatedChunks[0].page !== null) {
        const firstChunkPage = updatedChunks[0].page;
        if (firstChunkPage > 0 && firstChunkPage <= pdf.numPages) {
          setCurrentPage(firstChunkPage);
        }
      }
    } catch (err) {
      console.error('Error searching for chunk pages:', err);
      // On error, use raw chunks
      setResolvedChunks(chunksToSearch);
    } finally {
      setSearchingPages(false);
    }
  };

  /**
   * Search for a single chunk's text across all pages of the PDF.
   * Returns the first page where the chunk text is found, or null if not found.
   * 
   * Requirements: 6.4, 3.4
   */
  const searchChunkAcrossPages = async (pdf: any, chunk: ChunkData): Promise<number | null> => {
    const numPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Build text items array for matching
        const textItems = textContent.items.map((item: any) => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height
        }));
        
        const textContentForMatcher: TextContent = { items: textItems };
        const matchResult = findChunkOnPage(chunk, textContentForMatcher);
        
        if (matchResult.found && matchResult.matchedItems.length > 0) {
          console.log(`[PDFViewer] Found chunk "${chunk.chunk_id}" on page ${pageNum}`);
          return pageNum;
        }
      } catch (err) {
        console.warn(`[PDFViewer] Error searching page ${pageNum}:`, err);
        // Continue to next page
      }
    }
    
    console.log(`[PDFViewer] Chunk "${chunk.chunk_id}" not found on any page`);
    return null;
  };

  // Render page with highlighting
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        // Get text content for highlighting
        const textContent = await page.getTextContent();
        
        // Highlight all chunks on the current page (Requirements: 2.5)
        const pageChunks = chunks.filter(chunk => chunk.page === currentPage);
        if (pageChunks.length > 0) {
          highlightChunksOnPage(textContent, viewport, context, pageChunks);
        } else {
          setHighlightRects([]);
          setHighlightsFound(false);
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale, chunks]);

  // Highlight multiple chunks on a page
  // Requirements: 2.1, 2.3, 2.5
  const highlightChunksOnPage = (
    textContent: any, 
    viewport: any, 
    context: CanvasRenderingContext2D, 
    pageChunks: ChunkData[]
  ) => {
    const allRects: HighlightRect[] = [];
    let foundAnyHighlights = false;
    
    // Build text items array for matching
    const textItems = textContent.items.map((item: any) => ({
      str: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height
    }));

    const textContentForMatcher: TextContent = { items: textItems };

    // Process each chunk on this page
    pageChunks.forEach((chunk, chunkIdx) => {
      const globalChunkIndex = chunks.findIndex(c => c.chunk_id === chunk.chunk_id);
      const matchResult = findChunkOnPage(chunk, textContentForMatcher);
      
      if (matchResult.found && matchResult.matchedItems.length > 0) {
        foundAnyHighlights = true;
        // Draw highlights for matched items
        context.fillStyle = 'rgba(255, 255, 0, 0.4)'; // Yellow with transparency
        
        matchResult.matchedItems.forEach(itemIndex => {
          const item = textItems[itemIndex];
          const transform = item.transform;
          
          // Calculate position
          const x = transform[4];
          const y = transform[5];
          const width = item.width;
          const height = item.height || 12;
          
          // Transform coordinates to viewport
          const [x1, y1] = viewport.convertToViewportPoint(x, y);
          const [x2, y2] = viewport.convertToViewportPoint(x + width, y + height);
          
          // Draw highlight rectangle
          context.fillRect(x1, y1 - (y2 - y1), x2 - x1, y2 - y1);
          
          allRects.push({ 
            x: x1, 
            y: y1, 
            width: x2 - x1, 
            height: y2 - y1,
            chunkIndex: globalChunkIndex >= 0 ? globalChunkIndex : chunkIdx
          });
        });
      }
    });
    
    // Cache highlights for this page
    setHighlightsByPage(prev => {
      const newMap = new Map(prev);
      newMap.set(currentPage, allRects);
      return newMap;
    });
    
    setHighlightRects(allRects);
    setHighlightsFound(foundAnyHighlights);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  /**
   * Navigate to the previous chunk
   * Requirements: 4.1, 4.2
   */
  const handlePrevChunk = useCallback(() => {
    if (chunks.length <= 1) return;
    
    const newIndex = clampChunkIndex(currentChunkIndex - 1, chunks.length);
    setCurrentChunkIndex(newIndex);
    
    // Navigate to the chunk's page if it has one
    const targetChunk = chunks[newIndex];
    if (targetChunk && targetChunk.page !== null && targetChunk.page > 0 && targetChunk.page <= totalPages) {
      setCurrentPage(targetChunk.page);
    }
    
    // Notify parent component of chunk change
    onChunkChange?.(newIndex);
  }, [chunks, currentChunkIndex, totalPages, onChunkChange]);

  /**
   * Navigate to the next chunk
   * Requirements: 4.1, 4.2
   */
  const handleNextChunk = useCallback(() => {
    if (chunks.length <= 1) return;
    
    const newIndex = clampChunkIndex(currentChunkIndex + 1, chunks.length);
    setCurrentChunkIndex(newIndex);
    
    // Navigate to the chunk's page if it has one
    const targetChunk = chunks[newIndex];
    if (targetChunk && targetChunk.page !== null && targetChunk.page > 0 && targetChunk.page <= totalPages) {
      setCurrentPage(targetChunk.page);
    }
    
    // Notify parent component of chunk change
    onChunkChange?.(newIndex);
  }, [chunks, currentChunkIndex, totalPages, onChunkChange]);

  /**
   * Handle opening PDF in a new tab as fallback
   * Requirements: 6.2
   */
  const handleOpenInNewTab = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (searchingPages) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Searching for highlighted text...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Unable to Load PDF</h3>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <Button
            onClick={handleOpenInNewTab}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
          <p className="text-slate-500 text-xs mt-3">
            If the PDF doesn't open, the document may be unavailable or restricted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="text-white hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="text-white hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Chunk Navigation Controls - Requirements: 4.1, 4.2 */}
        {chunks.length > 1 && (
          <div className="flex items-center gap-2 border-l border-slate-600 pl-4 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevChunk}
              disabled={currentChunkIndex <= 0}
              className="text-white hover:bg-slate-700"
              title="Previous chunk"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <span className="text-sm whitespace-nowrap">
              Chunk {currentChunkIndex + 1} of {chunks.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextChunk}
              disabled={currentChunkIndex >= chunks.length - 1}
              className="text-white hover:bg-slate-700"
              title="Next chunk"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="text-white hover:bg-slate-700"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="text-white hover:bg-slate-700"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chunk info banner - Requirements: 2.4, 5.4, 6.3
          - Display chunk text preview (max 200 chars with ellipsis)
          - Show chunk navigation context (e.g., "Chunk 1 of 3")
          - Display banner even when no highlights found */}
      {currentChunk && (
        <div className="bg-yellow-200 border-b-2 border-yellow-400 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className={`w-6 h-6 ${highlightsFound ? 'bg-yellow-400' : 'bg-yellow-300'} rounded-full flex items-center justify-center`}>
                <span className="text-yellow-900 font-bold text-xs">{highlightsFound ? '✓' : '!'}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-bold text-yellow-900 mb-1 text-sm">
                📌 Retrieved Chunk{chunks.length > 1 ? ` ${currentChunkIndex + 1} of ${chunks.length}` : ''} 
                {highlightsFound 
                  ? ' - Text highlighted in yellow was used to answer your question'
                  : ' - No matching text found on this page'}
              </p>
              <div className="bg-yellow-50 border border-yellow-300 rounded p-2">
                <p className="text-yellow-900 text-xs leading-relaxed line-clamp-2">
                  "{truncateText(currentChunk.text, 200)}"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="shadow-lg border border-slate-300"
          />
        </div>
      </div>
    </div>
  );
};
