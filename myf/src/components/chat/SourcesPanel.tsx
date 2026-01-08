import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  FileText, 
  Table2, 
  Copy, 
  Check,
  Folder,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Source } from "@/types/chat";
import { toast } from "@/hooks/use-toast";

interface SourcesPanelProps {
  sources: Source[];
  tableCount?: number;
  docCount?: number;
}

export function SourcesPanel({ sources, tableCount = 0, docCount = 0 }: SourcesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopyPath = async (path: string) => {
    await navigator.clipboard.writeText(path);
    setCopiedPath(path);
    toast({ title: "Path copied to clipboard" });
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (sources.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4 border border-border rounded-xl overflow-hidden bg-card"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm text-foreground">
            Referenced Sources
          </span>
          <Badge variant="secondary" className="text-xs">
            {sources.length}
          </Badge>
          {tableCount > 0 && (
            <Badge className="text-xs bg-success/20 text-success border-0">
              {tableCount} table{tableCount > 1 ? "s" : ""}
            </Badge>
          )}
          {docCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {docCount} doc{docCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="p-3 space-y-2">
              {sources.map((source, index) => (
                <motion.div
                  key={`${source.filename}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors border-l-3 border-primary/30 hover:border-primary"
                >
                  {/* Icon */}
                  <div className={`p-1.5 rounded-md ${
                    source.is_table 
                      ? "bg-success/10 text-success" 
                      : "bg-primary/10 text-primary"
                  }`}>
                    {source.is_table ? (
                      <Table2 className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">
                        {index + 1}. {source.filename}
                      </span>
                      <Badge 
                        variant={source.is_table ? "default" : "secondary"} 
                        className={`text-xs ${source.is_table ? "bg-success text-success-foreground" : ""}`}
                      >
                        {source.is_table ? "📊 Table" : "📄 Doc"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="truncate">📁 {source.path}</span>
                      {source.chunks_used > 1 && (
                        <span className="flex items-center gap-1 text-primary">
                          <Layers className="h-3 w-3" />
                          {source.chunks_used} sections
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Copy Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCopyPath(source.path)}
                  >
                    {copiedPath === source.path ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
