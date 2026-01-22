import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Mic, Paperclip, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { transcribeAudio } from "@/lib/api";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  initialMessage?: string;
  onInitialMessageUsed?: () => void;
}

export function MessageInput({ onSendMessage, isLoading, disabled, initialMessage, onInitialMessageUsed }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          try {
            setIsTranscribing(true);
            const text = await transcribeAudio(blob);
            const newMessage = (message ? message + ' ' : '') + text;
            setMessage(newMessage);
            
            // Auto-submit after transcription if we have content
            if (newMessage.trim() && !isLoading && !disabled) {
              setTimeout(() => {
                onSendMessage(newMessage.trim());
                setMessage("");
                // Reset textarea height
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto";
                }
              }, 100); // Small delay to ensure state is updated
            }
          } catch (error) {
            console.error('Transcription failed:', error);
            alert('Failed to transcribe audio. Please try again.');
          } finally {
            setIsTranscribing(false);
            stream.getTracks().forEach(track => track.stop());
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert("Microphone access denied or not available.");
      }
    }
  };

  // Set initial message when provided
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      // Focus the textarea
      setTimeout(() => {
        textareaRef.current?.focus();
        // Move cursor to end
        if (textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 100);
      // Notify parent that initial message was used
      if (onInitialMessageUsed) {
        onInitialMessageUsed();
      }
    }
  }, [initialMessage, onInitialMessageUsed]);

  const handleSubmit = () => {
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t bg-background"
    >
      {/* Input Area (ChatGPT-like) */}
      <div
        className={cn(
          "relative px-4 py-3 transition-colors",
          isDragging && "bg-blue-50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 bg-card rounded-3xl px-3 py-2 border border-border shadow-none">
            {/* Plus/Attachment inside left */}
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Attach"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something..."
              disabled={disabled || isLoading}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-6 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground overflow-y-auto"
            />

            {/* Transcription status indicator */}
            {isTranscribing && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 mr-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Transcribing...</span>
              </div>
            )}

            {/* Mic inside right */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted",
                isRecording && "text-red-500 hover:text-red-600 animate-pulse bg-red-50 hover:bg-red-100"
              )}
              onClick={handleMicClick}
              disabled={disabled || isTranscribing}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            {/* Send inside right */}
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || isLoading || disabled}
              variant="ghost"
              size="icon"
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full transition-all",
                !message.trim() || isLoading || disabled
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Hint */}
          <div className="flex items-center justify-end mt-2 px-3 text-xs text-muted-foreground">
            <span>Enter to send • Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
