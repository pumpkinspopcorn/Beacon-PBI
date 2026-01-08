import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChartData } from '@/types/powerbi-chat';

interface ChartCardProps {
  chart: ChartData;
  onExpand?: () => void;
  compact?: boolean;
}

const COLORS = ['#F2C94C', '#2F80ED', '#27AE60', '#EB5757', '#9B51E0', '#F2994A'];

export const ChartCard: React.FC<ChartCardProps> = ({ 
  chart, 
  onExpand,
  compact = true,
}) => {
  const [hovered, setHovered] = useState(false);

  const renderChart = () => {
    const height = compact ? 250 : 400;

    switch (chart.type) {
      case 'bar':
      case 'column':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey={chart.config?.xAxis || 'name'} 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend />
              {chart.config?.series?.map((series, index) => (
                <Bar 
                  key={series}
                  dataKey={series} 
                  fill={chart.config?.colors?.[index] || COLORS[index % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              )) || (
                <Bar 
                  dataKey={chart.config?.yAxis || 'value'} 
                  fill={COLORS[0]}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey={chart.config?.xAxis || 'name'} 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={chart.config?.yAxis || 'value'} 
                stroke={chart.config?.colors?.[0] || COLORS[0]}
                strokeWidth={2}
                dot={{ fill: chart.config?.colors?.[0] || COLORS[0], r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey={chart.config?.xAxis || 'name'} 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey={chart.config?.yAxis || 'value'} 
                stroke={chart.config?.colors?.[0] || COLORS[0]}
                fill={chart.config?.colors?.[0] || COLORS[0]}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chart.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={compact ? 80 : 120}
                innerRadius={chart.type === 'donut' ? (compact ? 50 : 80) : 0}
                fill="#8884d8"
                dataKey="value"
              >
                {chart.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="x" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                dataKey="y"
                stroke="#64748b" 
                style={{ fontSize: '12px' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Scatter 
                data={chart.data} 
                fill={chart.config?.colors?.[0] || COLORS[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 text-slate-500">
            Chart type not supported: {chart.type}
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm my-3',
        compact && 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all'
      )}
      onClick={compact && onExpand ? onExpand : undefined}
    >
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          <span className="font-medium text-slate-900">
            {chart.title || 'Chart'}
          </span>
          <Badge variant="secondary" className="text-xs capitalize">
            {chart.type}
          </Badge>
        </div>

        {compact && onExpand && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 w-8 p-0 transition-opacity',
              hovered ? 'opacity-100' : 'opacity-0'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Chart */}
      <div className="p-4">
        {renderChart()}
      </div>

      {/* Description */}
      {chart.description && (
        <div className="px-4 pb-4">
          <p className="text-sm text-slate-600">{chart.description}</p>
        </div>
      )}
    </motion.div>
  );
};
