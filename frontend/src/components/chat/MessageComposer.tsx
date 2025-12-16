import React, { useRef, useEffect, useState, KeyboardEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  X, 
  Mic, 
  MicOff,
  Settings, 
  Loader2,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FileAttachment } from '@/types/powerbi-chat';

interface MessageComposerProps {
  onSendMessage: (content: string, attachments: FileAttachment[]) => void;
  onAttachFile: (file: File) => Promise<FileAttachment>;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  editMode?: {
    messageId: string;
    content: string;
    onSave: (content: string) => Promise<void> | void;
    onCancel: () => void;
  };
  disabled?: boolean;
  placeholder?: string;
  // Pre-fill content from outside (e.g., for template prompts)
  prefillContent?: string;
  onPrefillConsumed?: () => void;
}

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 52;

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onAttachFile,
  isStreaming = false,
  onStopStreaming,
  editMode,
  disabled = false,
  placeholder = 'Message Power BI Assistant...',
  prefillContent,
  onPrefillConsumed,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set content when entering edit mode
  useEffect(() => {
    if (editMode) {
      setContent(editMode.content);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          editMode.content.length,
          editMode.content.length
        );
      }, 0);
    } else {
      setContent('');
      setAttachments([]);
    }
  }, [editMode]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, [content]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle prefill content from outside
  useEffect(() => {
    if (prefillContent) {
      setContent(prefillContent);
      onPrefillConsumed?.();
      // Focus and move cursor to end
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          prefillContent.length,
          prefillContent.length
        );
      }, 0);
    }
  }, [prefillContent, onPrefillConsumed]);

  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    if (disabled || isUploading) return;

    if (editMode) {
      await editMode.onSave(content);
      // After successful save, clear composer state
      setContent('');
      setAttachments([]);
    } else {
      onSendMessage(content, attachments);
      setContent('');
      setAttachments([]);
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = send, Shift+Enter = newline (ChatGPT behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const attachment = await onAttachFile(files[i]);
        newAttachments.push(attachment);
      } catch (error) {
        console.error('Failed to upload file:', error);
        // Show error toast
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileSelect(e.dataTransfer.files);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pbix':
      case 'xlsx':
      case 'csv':
        return FileSpreadsheet;
      case 'png':
      case 'jpg':
        return ImageIcon;
      case 'pdf':
        return FileText;
      default:
        return File;
    }
  };

  // Web Speech API recognition ref
  const recognitionRef = useRef<any>(null);

  // Start voice recognition using Web Speech API (browser-native, no backend needed)
  const startRecording = useCallback(() => {
    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Web Speech API not supported in this browser');
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      console.log('🎤 Speech recognition started');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Show interim results in real-time
      setContent(prev => {
        const base = prev.replace(/\[listening...\]$/, '').trim();
        const newText = (finalTranscript + interimTranscript).trim();
        return base + (base && newText ? ' ' : '') + newText;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      console.log('🎤 Speech recognition ended');
      textareaRef.current?.focus();
    };

    recognition.start();
  }, []);

  // Stop voice recognition
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // Toggle recording
  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !isUploading && !isRecording;

  return (
    <div className="bg-transparent">
      {/* Edit mode banner */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Editing message</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={editMode.onCancel}
              className="h-7 text-amber-700 hover:text-amber-900"
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pt-3 pb-2 flex flex-wrap gap-2"
          >
            {attachments.map((attachment) => {
              const Icon = getFileIcon(attachment.type);
              return (
                <motion.div
                  key={attachment.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 group"
                >
                  <Icon className="w-4 h-4 text-slate-600" />
                  <span className="text-sm text-slate-700 max-w-[150px] truncate">
                    {attachment.name}
                  </span>
                  <button
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-700" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main composer */}
      <div
        className={cn(
          'relative px-4 py-3 transition-colors',
          isDragging && 'bg-blue-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto px-4">
          <div className="relative flex items-end gap-2 px-3 py-1.5 transition-all border border-border rounded-xl bg-transparent">
            {/* Attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading || !!editMode}
              className="flex-shrink-0 p-2 text-slate-500 hover:text-slate-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Attach file"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pbix,.csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                'flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-6',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
                'placeholder:text-slate-400',
                'overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent'
              )}
              style={{
                minHeight: MIN_HEIGHT - 16,
                maxHeight: MAX_HEIGHT - 16,
              }}
              aria-label="Message input"
            />

            {/* Mic inside input */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMicClick}
              className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full transition-all disabled:opacity-50',
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
              disabled={!!editMode || disabled}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>

            {/* Send/Stop button */}
            {isStreaming ? (
              <Button
                onClick={onStopStreaming}
                size="icon"
                variant="ghost"
                className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white"
                aria-label="Stop generating"
              >
                <div className="w-3 h-3 bg-white rounded-sm" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                variant="ghost"
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full transition-all',
                  canSend ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-slate-400 cursor-not-allowed'
                )}
                aria-label={editMode ? 'Save edit' : 'Send message'}
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Footer helper text removed per request */}
        </div>
      </div>

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none z-10"
          >
            <div className="text-center">
              <Paperclip className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <p className="text-lg font-medium text-blue-700">Drop files to upload</p>
              <p className="text-sm text-blue-600 mt-1">PBIX, CSV, XLSX, JSON, PNG, JPG, PDF</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
