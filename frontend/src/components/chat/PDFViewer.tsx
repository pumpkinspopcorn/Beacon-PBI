import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Download,
  X,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  filename?: string;
  onClose?: () => void;
  embedded?: boolean; // If true, shows inline. If false, shows as modal
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  url,
  filename = 'Report',
  onClose,
  embedded = true,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(750);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    setError(`Failed to load PDF: ${err.message}`);
    setLoading(false);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  // Full URL for the API
  const fullUrl = url.startsWith('http') ? url : `http://localhost:8000${url}`;

  // Calculate page width based on container
  useEffect(() => {
    const updatePageWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        // Use 75% of container width, with a max of 1000px for better viewing
        const calculatedWidth = Math.min(containerWidth * 0.75, 1000);
        setPageWidth(calculatedWidth);
      }
    };

    updatePageWidth();
    window.addEventListener('resize', updatePageWidth);
    return () => window.removeEventListener('resize', updatePageWidth);
  }, [isExpanded]);

  const viewerContent = (
    <div
      className={cn(
        'flex flex-col bg-slate-900 rounded-lg overflow-hidden',
        isExpanded ? 'fixed inset-4 z-50' : 'w-full h-full',
        embedded ? 'min-h-[600px]' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white truncate max-w-[200px]">
            {filename}
          </span>
          {numPages > 0 && (
            <span className="text-xs text-slate-400">
              ({numPages} page{numPages > 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-slate-600 mx-2" />

          {/* Download */}
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadPDF}
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          {/* Close */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content - Scrollable with all pages */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden bg-slate-800',
          isExpanded ? 'p-8' : 'p-4'
        )}
      >
        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-red-400">
            <FileText className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{error}</p>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Open PDF in new tab
            </a>
          </div>
        )}

        {!error && (
          <div className="flex flex-col items-center w-full">
            <Document
              file={fullUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="w-full flex flex-col items-center"
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  className="mb-6 last:mb-0 flex justify-center w-full"
                >
                  <div className="w-full max-w-full flex justify-center">
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-xl max-w-full h-auto"
                      width={pageWidth * scale}
                    />
                  </div>
                </div>
              ))}
            </Document>
          </div>
        )}
      </div>
    </div>
  );

  // If expanded, show with backdrop
  if (isExpanded) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/70 z-40"
          onClick={() => setIsExpanded(false)}
        />
        {viewerContent}
      </>
    );
  }

  return viewerContent;
};

/**
 * Inline PDF preview card - shown in chat messages
 */
interface PDFPreviewCardProps {
  url: string;
  filename: string;
  onOpen: () => void;
}

export const PDFPreviewCard: React.FC<PDFPreviewCardProps> = ({
  url,
  filename,
  onOpen,
}) => {
  const displayName = filename
    .replace('.pdf', '')
    .replace('.PDF', '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 mt-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer group"
      onClick={onOpen}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
        <FileText className="w-5 h-5 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {displayName}
        </p>
        <p className="text-xs text-slate-500">PDF Report • Click to view</p>
      </div>
      <Maximize2 className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
    </motion.div>
  );
};

