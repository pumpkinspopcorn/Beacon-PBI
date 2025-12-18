import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const suggestions = [
  "What documents do you have?",
  "Show me the latest reports",
  "Analyze the sales data",
  "Summarize the key findings",
];

export function MessageInput({ onSendMessage, isLoading, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-t bg-background"
    >
      {/* Quick Suggestions (only show when empty) */}
      {!message && (
        <div className="flex flex-wrap gap-2 mb-3 px-4 pt-3">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={suggestion}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSuggestionClick(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      )}

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

            {/* Mic inside right */}
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Voice input"
            >
              <Mic className="w-4 h-4" />
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
