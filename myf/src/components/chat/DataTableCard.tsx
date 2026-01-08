import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Table as TableIcon,
  Search,
  Copy,
  Download,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TableData, TableColumn } from '@/types/powerbi-chat';

interface DataTableCardProps {
  table: TableData;
  onExpand?: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

export const DataTableCard: React.FC<DataTableCardProps> = ({ table, onExpand }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [copied, setCopied] = useState(false);

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!searchQuery) return table.rows;

    return table.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [table.rows, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle numeric values (remove $ and % signs)
      const aNum = parseFloat(String(aVal).replace(/[$%,]/g, ''));
      const bNum = parseFloat(String(bVal).replace(/[$%,]/g, ''));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleCopyTable = async () => {
    // Convert table to TSV format
    const headers = table.columns.map((col) => col.label).join('\t');
    const rows = sortedRows
      .map((row) => table.columns.map((col) => row[col.key]).join('\t'))
      .join('\n');
    const tsv = `${headers}\n${rows}`;

    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const headers = table.columns.map((col) => col.label).join(',');
    const rows = sortedRows
      .map((row) =>
        table.columns
          .map((col) => {
            const value = String(row[col.key]);
            // Escape commas and quotes
            return value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(',')
      )
      .join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.title || 'table'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-40" />;
    }

    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 ml-1" />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm my-3"
    >
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-slate-600" />
            <span className="font-medium text-slate-900">
              {table.title || 'Data Table'}
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {table.totalRows} {table.totalRows === 1 ? 'row' : 'rows'}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-40 pl-8 text-sm"
            />
          </div>

          {/* Copy */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyTable}
            className="h-8 w-8 p-0"
            title="Copy table"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>

          {/* Export CSV */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 w-8 p-0"
            title="Export as CSV"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {table.columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    'font-semibold text-slate-700 h-10',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.sortable && 'cursor-pointer select-none group'
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div
                    className={cn(
                      'flex items-center',
                      column.align === 'right' && 'justify-end',
                      column.align === 'center' && 'justify-center'
                    )}
                  >
                    {column.label}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.columns.length}
                  className="text-center text-slate-500 py-8"
                >
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row, index) => (
                <TableRow key={index} className="hover:bg-slate-50">
                  {table.columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        'py-3',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.type === 'number' && 'font-medium tabular-nums',
                        column.type === 'percentage' && 'font-medium tabular-nums'
                      )}
                    >
                      {row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-600 flex items-center justify-between">
        <span>
          Showing {sortedRows.length} of {table.totalRows} rows
        </span>
        {onExpand && (
          <Button
            variant="link"
            size="sm"
            onClick={onExpand}
            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
          >
            View full table →
          </Button>
        )}
      </div>
    </motion.div>
  );
};
