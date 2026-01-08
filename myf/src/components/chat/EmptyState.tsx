import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Calculator, TrendingUp, RefreshCw, Network, Award, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StarterPrompt } from '@/types/powerbi-chat';

interface EmptyStateProps {
  starterPrompts: StarterPrompt[];
  onSelectPrompt: (prompt: string) => void;
}

const iconMap: Record<string, any> = {
  Calculator,
  Zap,
  RefreshCw,
  Network,
  Award,
  TrendingUp,
  AlertTriangle,
  Info,
  HelpCircle,
};

const iconColorMap: Record<string, { bg: string; hoverBg: string; icon: string }> = {
  AlertTriangle: {
    bg: 'from-red-50 to-red-100',
    hoverBg: 'group-hover:from-red-100 group-hover:to-red-200',
    icon: 'text-red-600',
  },
  Zap: {
    bg: 'from-blue-50 to-blue-100',
    hoverBg: 'group-hover:from-blue-100 group-hover:to-blue-200',
    icon: 'text-blue-600',
  },
  Info: {
    bg: 'from-blue-50 to-blue-100',
    hoverBg: 'group-hover:from-blue-100 group-hover:to-blue-200',
    icon: 'text-blue-600',
  },
  HelpCircle: {
    bg: 'from-slate-50 to-slate-100',
    hoverBg: 'group-hover:from-slate-100 group-hover:to-slate-200',
    icon: 'text-slate-600',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({ starterPrompts, onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-4xl w-full"
      >
        {/* Welcome message */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center justify-center gap-2">
            <span className="text-4xl">👋</span>
            Hello! I'm your intelligent assistant.
          </h1>
          <p className="text-base text-slate-600">
            I can help you with various technical issues and questions. Click on any option below to get started.
          </p>
        </div>

        {/* Starter prompts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {starterPrompts.map((prompt, index) => {
              const Icon = iconMap[prompt.icon || 'Zap'];
              const colors = iconColorMap[prompt.icon || 'Zap'] || iconColorMap.Zap;
              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Card
                    className={cn(
                      'p-5 cursor-pointer transition-all duration-200',
                      'hover:shadow-lg hover:border-slate-300 hover:-translate-y-1',
                      'group border-slate-200'
                    )}
                    onClick={() => onSelectPrompt(prompt.prompt)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center transition-colors',
                        colors.bg,
                        colors.hoverBg
                      )}>
                        {Icon && <Icon className={cn('w-6 h-6', colors.icon)} />}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-semibold text-slate-900 mb-1">
                          {prompt.title}
                        </h3>
                        {prompt.description && (
                          <p className="text-sm text-slate-600">{prompt.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};
