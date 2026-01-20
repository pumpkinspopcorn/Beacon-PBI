import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  BarChart3,
  File,
  ExternalLink,
  Globe,
  Eye,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ReferencedSource, ChunkData } from '@/types/powerbi-chat';
import { PDFViewerWithHighlight } from './PDFViewerWithHighlight';
import { TextViewerWithHighlight } from './TextViewerWithHighlight';

interface ReferencedSourcesPanelProps {
  sources: ReferencedSource[];
  defaultExpanded?: boolean;
}

export const ReferencedSourcesPanel: React.FC<ReferencedSourcesPanelProps> = ({
  sources,
  defaultExpanded = true, // Changed to true so sources are visible by default
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewingDocument, setViewingDocument] = useState<{ 
    url: string; 
    name: string;
    chunks: ChunkData[];
  } | null>(null);

  if (!sources || sources.length === 0) return null;

  /**
   * Normalize chunks from a source, handling backward compatibility
   * with the old chunk_data format.
   * Requirements: 2.1 - Map source.chunks to PDFViewerWithHighlight props
   */
  const getChunksFromSource = (source: ReferencedSource): ChunkData[] => {
    // Prefer new chunks array if available
    if (source.chunks && Array.isArray(source.chunks) && source.chunks.length > 0) {
      return source.chunks;
    }
    
    // Fall back to legacy chunk_data format for backward compatibility
    if (source.chunk_data) {
      return [source.chunk_data];
    }
    
    return [];
  };

  // Count sources by type
  const sourceCounts = sources.reduce((acc, source) => {
    acc[source.type] = (acc[source.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'table':
        return FileSpreadsheet;
      case 'doc':
      case 'file':
        return FileText;
      case 'chart':
        return BarChart3;
      case 'web':
        return Globe;
      default:
        return File;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'table':
        return 'Table';
      case 'doc':
        return 'Doc';
      case 'chart':
        return 'Chart';
      case 'file':
        return 'File';
      case 'web':
        return 'Web';
      default:
        return type;
    }
  };

  const isDocumentUrl = (url: string): boolean => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.pdf') || 
           lowerUrl.includes('.doc') || 
           lowerUrl.includes('.docx') || 
           lowerUrl.includes('.txt') ||
           lowerUrl.includes('.xlsx') ||
           lowerUrl.includes('.xls');
  };

  const handleSourceClick = (source: ReferencedSource) => {
    // Get normalized chunks array (handles both new chunks array and legacy chunk_data)
    const chunks = getChunksFromSource(source);
    console.log(`[ReferencedSourcesPanel] Clicking source "${source.name}" with ${chunks.length} chunks:`, chunks);
    
    // If source has a path/URL
    if (source.path) {
      // Check if it's a document (PDF, DOC, etc.) - open in viewer
      if (isDocumentUrl(source.path)) {
        setViewingDocument({ 
          url: source.path, 
          name: source.name,
          chunks: chunks // Pass chunks array for highlighting
        });
        return;
      }
      
      // If it's a web link or starts with http, open in new tab
      if (source.type === 'web' || source.path.startsWith('http')) {
        window.open(source.path, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    
    // For file sources without URLs, try to construct blob URL if possible
    // (This handles cases where the source might have metadata with URL)
    if ((source.type === 'file' || source.type === 'doc') && source.metadata?.url) {
      const docUrl = source.metadata.url;
      if (isDocumentUrl(docUrl)) {
        setViewingDocument({ 
          url: docUrl, 
          name: source.name,
          chunks: chunks
        });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 my-3 shadow-sm"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-900">
              Sources
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {sources.length}
          </Badge>
          <div className="flex items-center gap-1.5">
            {Object.entries(sourceCounts).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs">
                {count} {getTypeLabel(type)}
                {count > 1 ? 's' : ''}
              </Badge>
            ))}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {/* Source list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 bg-white"
          >
            <div className="p-3 space-y-2">
              {sources.map((source, index) => {
                const Icon = getSourceIcon(source.type);
                // A source is clickable if:
                // 1. It has a path that starts with http (document or web link)
                // 2. It's a file/doc type with a path (document)
                // 3. It's a web type with a path
                const hasHttpUrl = source.path && source.path.startsWith('http');
                const isDocument = hasHttpUrl && isDocumentUrl(source.path);
                const isClickable = hasHttpUrl || 
                                   (source.type === 'web' && source.path) ||
                                   ((source.type === 'file' || source.type === 'doc') && source.path);
                
                return (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md transition-colors group",
                      isClickable 
                        ? "hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200" 
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => handleSourceClick(source)}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                      source.type === 'web' ? "bg-blue-50" : "bg-slate-50"
                    )}>
                      <Icon className={cn(
                        "w-4 h-4",
                        source.type === 'web' ? "text-blue-600" : "text-slate-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          isClickable ? "text-blue-700 group-hover:text-blue-800 underline decoration-dotted" : "text-slate-900"
                        )}>
                          {source.name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getTypeLabel(source.type)}
                        </Badge>
                        {isDocument && (
                          <div className="flex items-center gap-1 text-blue-500">
                            <Eye className="w-3 h-3" />
                            <span className="text-xs">View</span>
                          </div>
                        )}
                        {isClickable && !isDocument && (
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                      {source.path && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {source.type === 'web' || source.path.startsWith('http') ? (
                            <span className="text-blue-600 hover:text-blue-800">
                              {source.path}
                            </span>
                          ) : (
                            source.path
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] w-full p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {viewingDocument?.name}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => viewingDocument && window.open(viewingDocument.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-slate-50">
            {viewingDocument && (
              <div className="w-full h-[calc(90vh-80px)]">
                {viewingDocument.url.toLowerCase().endsWith('.pdf') ? (
                  <PDFViewerWithHighlight
                    url={viewingDocument.url}
                    chunks={viewingDocument.chunks}
                    title={viewingDocument.name}
                  />
                ) : viewingDocument.url.toLowerCase().endsWith('.txt') ? (
                  <TextViewerWithHighlight
                    url={viewingDocument.url}
                    chunks={viewingDocument.chunks}
                    title={viewingDocument.name}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                      <p className="text-slate-600 mb-4">Preview not available for this file type</p>
                      <Button
                        onClick={() => window.open(viewingDocument.url, '_blank', 'noopener,noreferrer')}
                        variant="outline"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
