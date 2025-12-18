import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Download, 
  Copy, 
  Check,
  Table2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface DataTableProps {
  columns: string[];
  rows: string[][];
  title?: string;
}

type SortDirection = "asc" | "desc" | null;

export function DataTable({ columns, rows, title }: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnIndex);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortColumn !== null && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortColumn] || "";
        const bVal = b[sortColumn] || "";
        
        // Try numeric sort first
        const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ""));
        const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ""));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
        
        // Fall back to string sort
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [rows, searchQuery, sortColumn, sortDirection]);

  const handleExportCSV = () => {
    const csvContent = [
      columns.join(","),
      ...filteredAndSortedRows.map((row) => 
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `table-export-${Date.now()}.csv`;
    link.click();
    
    toast({ title: "CSV downloaded successfully" });
  };

  const handleCopyMarkdown = async () => {
    const header = `| ${columns.join(" | ")} |`;
    const separator = `| ${columns.map(() => "---").join(" | ")} |`;
    const body = filteredAndSortedRows
      .map((row) => `| ${row.join(" | ")} |`)
      .join("\n");
    
    const markdown = `${header}\n${separator}\n${body}`;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast({ title: "Markdown copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getSortIcon = (columnIndex: number) => {
    if (sortColumn !== columnIndex) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3" />;
    }
    return <ArrowDown className="h-3 w-3" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-xl overflow-hidden bg-card"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {title || "Data Table"}
          </span>
          <Badge variant="secondary" className="text-xs">
            {filteredAndSortedRows.length} rows
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs w-full sm:w-40"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyMarkdown}
            className="h-8 gap-1.5 text-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Copy</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="bg-primary text-primary-foreground px-3 py-2.5 text-left font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-32">{col}</span>
                    {getSortIcon(i)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No matching results found
                </td>
              </tr>
            ) : (
              filteredAndSortedRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-border hover:bg-muted/50 transition-colors"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2.5">
                      <span className="truncate block max-w-48" title={cell}>
                        {cell}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredAndSortedRows.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          Showing {filteredAndSortedRows.length} of {rows.length} rows
          {searchQuery && ` (filtered)`}
        </div>
      )}
    </motion.div>
  );
}
