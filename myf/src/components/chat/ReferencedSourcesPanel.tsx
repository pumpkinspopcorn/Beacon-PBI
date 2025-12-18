import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  BarChart3,
  File,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReferencedSource } from '@/types/powerbi-chat';

interface ReferencedSourcesPanelProps {
  sources: ReferencedSource[];
  defaultExpanded?: boolean;
}

export const ReferencedSourcesPanel: React.FC<ReferencedSourcesPanelProps> = ({
  sources,
  defaultExpanded = false,
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
        return FileText;
      case 'chart':
        return BarChart3;
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
      default:
        return type;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 my-3"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-900">
            Referenced Sources
          </span>
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
                return (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-2.5 rounded-md hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {source.name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getTypeLabel(source.type)}
                        </Badge>
                      </div>
                      {source.path && (
                        <a
                          href={source.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 mt-0.5 truncate block hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {source.path}
                        </a>
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
