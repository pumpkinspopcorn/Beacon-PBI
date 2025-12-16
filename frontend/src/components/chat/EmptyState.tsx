import React from 'react';
import { motion } from 'framer-motion';
import { Zap, FileSearch, Users, BarChart3, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StarterPrompt } from '@/types/powerbi-chat';

interface EmptyStateProps {
  starterPrompts: StarterPrompt[];
  onSelectPrompt: (prompt: string, prefillOnly?: boolean) => void;
}

const iconMap: Record<string, any> = {
  FileSearch,
  Zap,
  Users,
  BarChart3,
  Layers,
};

export const EmptyState: React.FC<EmptyStateProps> = ({ starterPrompts, onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-4xl"
      >
        {/* Starter prompts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Get Started
          </h2>
          {/* First row - 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto mb-3">
            {starterPrompts.slice(0, 3).map((prompt, index) => {
              const Icon = iconMap[prompt.icon || 'Zap'];
              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Card
                    className={cn(
                      'p-4 cursor-pointer transition-all duration-200',
                      'hover:shadow-md hover:border-blue-300 hover:-translate-y-1',
                      'group'
                    )}
                    onClick={() => onSelectPrompt(prompt.prompt, prompt.prefillOnly)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                        {Icon && <Icon className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
                          {prompt.title}
                        </h3>
                        {prompt.description && (
                          <p className="text-xs text-slate-600">{prompt.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          {/* Second row - 2 Power BI Assistant cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {starterPrompts.slice(3, 5).map((prompt, index) => {
              const Icon = iconMap[prompt.icon || 'Zap'];
              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Card
                    className={cn(
                      'p-4 cursor-pointer transition-all duration-200',
                      'hover:shadow-md hover:border-blue-300 hover:-translate-y-1',
                      'group'
                    )}
                    onClick={() => onSelectPrompt(prompt.prompt, prompt.prefillOnly)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                        {Icon && <Icon className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
                          {prompt.title}
                        </h3>
                        {prompt.description && (
                          <p className="text-xs text-slate-600">{prompt.description}</p>
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
