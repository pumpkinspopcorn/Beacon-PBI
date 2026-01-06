import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path to use local worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface ChunkData {
  chunk_id: string;
  page: number | null;
  text: string;
}

interface PDFViewerWithHighlightProps {
  url: string;
  chunkData?: ChunkData;
  title: string;
}

export const PDFViewerWithHighlight: React.FC<PDFViewerWithHighlightProps> = ({
  url,
  chunkData,
  title
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [highlightRects, setHighlightRects] = useState<any[]>([]);

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
        
        // If chunk data has a page, navigate to it
        if (chunkData?.page && chunkData.page > 0 && chunkData.page <= pdf.numPages) {
          setCurrentPage(chunkData.page);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPDF();
  }, [url, chunkData]);

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
        
        // Find and highlight matching text
        if (chunkData && chunkData.text && currentPage === chunkData.page) {
          highlightText(textContent, viewport, context, chunkData.text);
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale, chunkData]);

  // Highlight text function
  const highlightText = (textContent: any, viewport: any, context: CanvasRenderingContext2D, searchText: string) => {
    const rects: any[] = [];
    
    // Normalize search text for better matching
    const normalizedSearch = searchText.toLowerCase().trim();
    
    // Build full text from items
    let fullText = '';
    const textItems = textContent.items;
    const textPositions: any[] = [];
    
    textItems.forEach((item: any) => {
      const text = item.str;
      textPositions.push({
        text: text,
        transform: item.transform,
        width: item.width,
        height: item.height,
        startIndex: fullText.length,
        endIndex: fullText.length + text.length
      });
      fullText += text + ' ';
    });
    
    const normalizedFullText = fullText.toLowerCase();
    
    // Find all occurrences of search text (try exact match first, then partial)
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 3); // Words longer than 3 chars
    const matchedItems = new Set<number>();
    
    // Try to match significant words from the chunk
    searchWords.forEach(word => {
      textPositions.forEach((item, index) => {
        if (item.text.toLowerCase().includes(word)) {
          matchedItems.add(index);
        }
      });
    });
    
    // Draw yellow highlights for matched items
    context.fillStyle = 'rgba(255, 255, 0, 0.4)'; // Yellow with transparency
    
    matchedItems.forEach(index => {
      const item = textPositions[index];
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
      
      rects.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    });
    
    setHighlightRects(rects);
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading PDF</p>
          <p className="text-slate-600 text-sm">{error}</p>
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

      {/* Chunk info banner */}
      {chunkData && currentPage === chunkData.page && (
        <div className="bg-yellow-200 border-b-2 border-yellow-400 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-yellow-900 font-bold text-xs">✓</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-bold text-yellow-900 mb-1 text-sm">
                📌 Retrieved Chunk - Text highlighted in yellow was used to answer your question
              </p>
              <div className="bg-yellow-50 border border-yellow-300 rounded p-2">
                <p className="text-yellow-900 text-xs leading-relaxed line-clamp-2">
                  "{chunkData.text.substring(0, 200)}{chunkData.text.length > 200 ? '...' : ''}"
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
