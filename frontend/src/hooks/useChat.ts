import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { askQuestion, clearHistory } from "@/lib/api";
import { Message } from "@/types/chat";
import { toast } from "sonner";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Demo data with table to showcase DataTable component
const DEMO_MESSAGES: Message[] = [
  {
    id: "demo-1",
    role: "user",
    content: "Show me the sales performance data for Q3 2024",
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: "demo-2",
    role: "assistant",
    content: `Here's the sales performance data for Q3 2024:

| Region | Q3 Sales | Target | Achievement | Growth |
|--------|----------|--------|-------------|--------|
| North America | $2.4M | $2.2M | 109% | +12% |
| Europe | $1.8M | $1.9M | 95% | +8% |
| Asia Pacific | $3.1M | $2.8M | 111% | +18% |
| Latin America | $0.9M | $0.8M | 113% | +15% |
| Middle East | $0.6M | $0.5M | 120% | +22% |

**Key Insights:**
- **Asia Pacific** leads with the highest absolute sales at $3.1M
- **Middle East** shows the strongest growth rate at 22%
- Overall Q3 performance exceeded targets by 8% on average
- Total Q3 revenue: **$8.8M** against target of **$8.2M**

The data shows strong momentum across emerging markets, particularly in Asia Pacific and Middle East regions.`,
    timestamp: new Date(Date.now() - 240000),
    sources: [
      { filename: "Q3_Sales_Report_2024.xlsx", path: "/data/sales/", type: "xlsx", is_table: true, chunks_used: 2 },
      { filename: "Regional_Targets_2024.pdf", path: "/docs/planning/", type: "pdf", is_table: false, chunks_used: 1 },
    ],
    hasTableData: true,
    tableCount: 1,
    docCount: 1,
  },
];

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);

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
        sources: data.sources,
        timestamp: new Date(),
        hasTableData: data.has_tables,
        tableCount: data.table_count,
        docCount: data.doc_count,
      };
      setMessages((prev) => [...prev, assistantMessage]);
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
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
        timestamp: new Date(),
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
    setMessages([]);
  }, []);

  return {
    messages,
    isTyping,
    isLoading: askMutation.isPending,
    sendMessage,
    clearChat,
    newChat,
    isClearingChat: clearMutation.isPending,
  };
}
