import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartCard } from './ChartCard';
import { DataTableCard } from './DataTableCard';
import { ChartData, TableData } from '@/types/powerbi-chat';

interface ContentExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  chart?: ChartData;
  table?: TableData;
  insight?: string;
}

export const ContentExpansionModal: React.FC<ContentExpansionModalProps> = ({
  isOpen,
  onClose,
  chart,
  table,
  insight,
}) => {
  const [selectedView, setSelectedView] = useState<'chart' | 'table'>('chart');

  const handleExportPNG = () => {
    // In a real app, this would use html2canvas or similar
    console.log('Exporting as PNG');
  };

  const handleExportSVG = () => {
    // In a real app, this would export the chart as SVG
    console.log('Exporting as SVG');
  };

  const handleExportCSV = () => {
    // Export table data or chart data as CSV
    console.log('Exporting as CSV');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {chart?.title || table?.title || 'Data View'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Export options */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPNG}
              >
                <Download className="w-4 h-4 mr-2" />
                PNG
              </Button>
              {chart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSVG}
                >
                  <Download className="w-4 h-4 mr-2" />
                  SVG
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <div className="p-6">
            {/* If both chart and table available, show tabs */}
            {chart && table ? (
              <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="chart">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Chart View
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <TableIcon className="w-4 h-4 mr-2" />
                    Table View
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="mt-0">
                  <ChartCard chart={chart} compact={false} />
                  {insight && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
                      <p className="text-sm text-blue-800">{insight}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="table" className="mt-0">
                  <DataTableCard table={table} />
                </TabsContent>
              </Tabs>
            ) : chart ? (
              <>
                <ChartCard chart={chart} compact={false} />
                {insight && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
                    <p className="text-sm text-blue-800">{insight}</p>
                  </div>
                )}
              </>
            ) : table ? (
              <DataTableCard table={table} />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
