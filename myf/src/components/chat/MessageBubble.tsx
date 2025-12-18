import React, { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { User, Bot, Clock, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Message } from "@/types/powerbi-chat";
import { MessageActions } from "./MessageActions.tsx";
import { DataTableCard } from "./DataTableCard";
import { ChartCard } from "./ChartCard";
import { ReferencedSourcesPanel } from "./ReferencedSourcesPanel";
import { ContentExpansionModal } from "./ContentExpansionModal";

interface MessageBubbleProps {
  message: Message;
  onLike?: () => void;
  onDislike?: (reason?: string, comment?: string) => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  showRegenerateLoading?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLike,
  onDislike,
  onCopy,
  onRegenerate,
  onEdit,
  onPin,
  onDelete,
  showRegenerateLoading,
}) => {
  const [expandedContent, setExpandedContent] = useState<{
    type: 'chart' | 'table';
    chart?: any;
    table?: any;
  } | null>(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.isStreaming || message.status === 'streaming';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.9, 0.2, 1] }}
        className={cn('flex gap-4 px-4 py-4 group', isUser && 'flex-row-reverse')}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar
            className={cn(
              'w-10 h-10 rounded-full bg-white shadow-sm ring-1 ring-gray-300',
              isUser && 'ring-2 ring-blue-500',
              isAssistant && 'bg-muted'
            )}
          >
            <AvatarFallback>
              {isUser ? (
                <User className="w-5 h-5 text-gray-700" />
              ) : (
                <Bot className="w-5 h-5 text-blue-600" />
              )}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className={cn('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
          {/* Role label */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">
              {isUser ? 'You' : 'Power BI Assistant'}
            </span>
            {isAssistant && message.metadata?.model && (
              <Badge variant="outline" className="text-xs">
                {message.metadata.model}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
            {message.isEdited && (
              <span className="text-xs text-muted-foreground italic">(edited)</span>
            )}
          </div>

          {/* Message content */}
          <div
            className={cn(
              'prose prose-sm max-w-none px-5 py-3.5 rounded-2xl border transition-shadow',
              isUser
                ? 'bg-chat-user text-chat-user-foreground border-border rounded-br-md shadow-lg'
                : 'bg-chat-bot text-chat-bot-foreground border-border rounded-bl-md shadow-md',
              'prose-headings:font-semibold',
              'prose-a:text-primary hover:prose-a:underline',
              'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none',
              'prose-pre:bg-slate-900 prose-pre:rounded-lg prose-pre:p-0 prose-pre:my-4'
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const inline = !language;

                  return !inline && language ? (
                    <div className="relative group/code">
                      <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                          }}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded"
                        >
                          Copy
                        </button>
                      </div>
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={language}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: [0.2, 0.9, 0.2, 1] }}
                className="inline-block w-1.5 h-4 bg-foreground/80 ml-0.5 align-middle"
              />
            )}
          </div>

          {/* Tables */}
          {message.tables?.map((table) => (
            <DataTableCard key={table.id} table={table} onExpand={() => setExpandedContent({ type: 'table', table })} />
          ))}

          {/* Charts */}
          {message.charts?.map((chart) => (
            <ChartCard key={chart.id} chart={chart} onExpand={() => setExpandedContent({ type: 'chart', chart })} />
          ))}

          {/* Referenced Sources */}
          {message.sources && message.sources.length > 0 && (
            <ReferencedSourcesPanel sources={message.sources} />
          )}

          {/* Metadata footer for assistant messages */}
          {isAssistant && message.metadata && !isStreaming && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {message.metadata.responseTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{message.metadata.responseTime.toFixed(1)}s</span>
                </div>
              )}
              {message.sources && message.sources.length > 0 && (
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{message.sources.length} source{message.sources.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {message.metadata.citationCount !== undefined && message.metadata.citationCount > 0 && (
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{message.metadata.citationCount} sources</span>
                </div>
              )}
            </div>
          )}

          {/* Message Actions */}
          {!isStreaming && (
            <div className="mt-2">
              <MessageActions
                message={message}
                onLike={onLike}
                onDislike={onDislike}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onPin={onPin}
                onDelete={onDelete}
                showRegenerateLoading={showRegenerateLoading}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Expansion modal */}
      <ContentExpansionModal
        isOpen={!!expandedContent}
        onClose={() => setExpandedContent(null)}
        chart={expandedContent?.type === 'chart' ? expandedContent.chart : undefined}
        table={expandedContent?.type === 'table' ? expandedContent.table : undefined}
      />
    </>
  );
};
