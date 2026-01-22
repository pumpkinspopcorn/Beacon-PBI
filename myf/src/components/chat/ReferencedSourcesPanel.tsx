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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReferencedSource } from '@/types/powerbi-chat';

interface ReferencedSourcesPanelProps {
  sources: ReferencedSource[];
  defaultExpanded?: boolean;
}

export const ReferencedSourcesPanel: React.FC<ReferencedSourcesPanelProps> = ({
  sources,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!sources || sources.length === 0) return null;

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

  const handleSourceClick = (source: ReferencedSource) => {
    // If source has a path/URL, open it
    if (source.path) {
      window.open(source.path, '_blank', 'noopener,noreferrer');
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
                const isClickable = source.path && source.path.startsWith('http');
                
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
                        {isClickable && (
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
    </motion.div>
  );
};
