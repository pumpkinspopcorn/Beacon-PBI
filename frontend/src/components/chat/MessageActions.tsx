import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  Edit,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Message } from '@/types/powerbi-chat';

interface MessageActionsProps {
  message: Message;
  onLike?: () => void;
  onDislike?: (reason?: string, comment?: string) => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onCiteSources?: () => void;
  onOpenInPanel?: () => void;
  showRegenerateLoading?: boolean;
}

type FeedbackReason = 'not-helpful' | 'incorrect' | 'offensive' | 'other';

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  onLike,
  onDislike,
  onCopy,
  onRegenerate,
  onEdit,
  showRegenerateLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDislikeDialog, setShowDislikeDialog] = useState(false);
  const [dislikeReason, setDislikeReason] = useState<FeedbackReason>('not-helpful');
  const [dislikeComment, setDislikeComment] = useState('');

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
    } else {
      await navigator.clipboard.writeText(message.content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDislikeSubmit = () => {
    onDislike?.(dislikeReason, dislikeComment);
    setShowDislikeDialog(false);
    setDislikeComment('');
  };

  const actionButtonClass = cn(
    'h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    'transition-all',
    'rounded-md'
  );

  return (
    <>
      <div className="flex items-center gap-1">
        {/* User message actions: Edit + Copy */}
        {isUser && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Edit */}
            {onEdit && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onEdit}
                      className={actionButtonClass}
                      aria-label="Edit message"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Edit
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Copy */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className={cn(actionButtonClass, copied && '!opacity-100')}
                    aria-label="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {copied ? 'Copied!' : 'Copy'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Assistant message actions: Like + Dislike + Copy + Regenerate */}
        {isAssistant && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Like */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onLike}
                    className={cn(
                      actionButtonClass,
                      message.isLiked && '!opacity-100 bg-green-100 text-green-700'
                    )}
                    aria-label="Like this response"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Good response
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Dislike */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDislikeDialog(true)}
                    className={cn(
                      actionButtonClass,
                      message.isDisliked && '!opacity-100 bg-red-100 text-red-700'
                    )}
                    aria-label="Dislike this response"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Bad response
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Copy */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className={cn(actionButtonClass, copied && '!opacity-100')}
                    aria-label="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {copied ? 'Copied!' : 'Copy'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Regenerate */}
            {onRegenerate && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRegenerate}
                      disabled={showRegenerateLoading}
                      className={actionButtonClass}
                      aria-label="Regenerate response"
                    >
                      <RefreshCw
                        className={cn('w-4 h-4', showRegenerateLoading && 'animate-spin')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Regenerate
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {/* Dislike Feedback Dialog */}
      <AlertDialog open={showDislikeDialog} onOpenChange={setShowDislikeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Provide feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Help us improve by telling us what went wrong.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={dislikeReason} onValueChange={(val) => setDislikeReason(val as FeedbackReason)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not-helpful" id="not-helpful" />
                <Label htmlFor="not-helpful" className="cursor-pointer">
                  Not helpful
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="incorrect" id="incorrect" />
                <Label htmlFor="incorrect" className="cursor-pointer">
                  Incorrect information
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="offensive" id="offensive" />
                <Label htmlFor="offensive" className="cursor-pointer">
                  Offensive or inappropriate
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="cursor-pointer">
                  Other
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="comment">Additional comments (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Tell us more..."
                value={dislikeComment}
                onChange={(e) => setDislikeComment(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDislikeSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
