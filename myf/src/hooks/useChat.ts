import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { askQuestion, clearHistory } from "@/lib/api";
import { Message } from "@/types/powerbi-chat";
import { toast } from "sonner";
import { getCurrentConversationId, setCurrentConversationId, updateMessages, getConversationById } from "@/lib/chatHistory";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Demo data removed - starting with empty chat

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]); // Start with empty chat
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => getCurrentConversationId() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  // Auto-create new chat on first load
  useEffect(() => {
    if (!isInitialized) {
      // Ensure we start with empty messages
      const existing = getConversationById(conversationId);
      setMessages(existing?.messages ?? []);
      setIsInitialized(true);
      setCurrentConversationId(conversationId);
      
      // Show a toast to indicate new chat is ready
      setTimeout(() => {
        toast.success("New chat session ready! Ask me anything.");
      }, 500);
    }
  }, [isInitialized]);

  // Persist messages to chat history on change
  useEffect(() => {
    updateMessages(conversationId, messages);
  }, [conversationId, messages]);

  const askMutation = useMutation({
    mutationFn: askQuestion,
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.answer,
        sources: data.sources?.map(source => ({
          id: source.id || generateId(),
          type: source.type === 'web' ? 'web' : 
                source.type === 'file' ? 'file' : 
                source.name?.endsWith('.xlsx') || source.name?.endsWith('.csv') ? 'table' :
                source.name?.endsWith('.pdf') || source.name?.endsWith('.doc') ? 'doc' : 'file',
          name: source.name || source.filename || "Unknown Source",
          path: source.path || (source as any).url, // Support both path and url fields
        })),
        timestamp: Date.now(),
        status: 'complete',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Invalidate observability queries to refresh real-time data
      queryClient.invalidateQueries({ queryKey: ["observability-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-requests"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to get response");
      
      // Add helpful error message for demo
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `I apologize, but I'm currently unable to connect to the backend server. 

**Note:** This React frontend is designed to work with your Flask backend. For deployment on Databricks:
1. Build this React app (\`npm run build\`)
2. Copy the \`dist\` folder contents to your Flask static folder
3. Update Flask to serve the built index.html
4. Or host React separately and configure CORS

The Flask backend should be running on port 8000 with these endpoints:
- \`POST /api/ask\` - Send questions
- \`POST /api/clear\` - Clear history
- \`GET /api/history\` - Get chat history
- \`GET /api/health\` - Health check`,
        timestamp: Date.now(),
        status: 'complete',
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      // Invalidate observability queries to refresh real-time data after failed request
      queryClient.invalidateQueries({ queryKey: ["observability-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-requests"] });
    },
    onSettled: () => {
      setIsTyping(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearHistory,
    onSuccess: () => {
      setMessages([]);
      toast.success("Chat history cleared");
    },
    onError: () => {
      // Clear locally even if API fails
      setMessages([]);
      toast.success("Chat cleared locally");
    },
  });

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || askMutation.isPending) return;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
        status: 'sent',
      };

      setMessages((prev) => [...prev, userMessage]);
      askMutation.mutate(content.trim());
    },
    [askMutation]
  );

  const clearChat = useCallback(() => {
    clearMutation.mutate();
  }, [clearMutation]);

  const newChat = useCallback(() => {
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setConversationId(newId);
    setCurrentConversationId(newId);
    setMessages([]);
    toast.success("New chat session started");
  }, []);

  return {
    messages,
    isTyping,
    isLoading: askMutation.isPending,
    sendMessage,
    clearChat,
    newChat,
    isClearingChat: clearMutation.isPending,
    conversationId,
  };
}
