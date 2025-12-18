export interface Source {
  filename: string;
  path: string;
  type: string;
  is_table: boolean;
  chunks_used: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
  hasTableData?: boolean;
  tableCount?: number;
  docCount?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  vector_search: boolean;
  llm: string;
  sessions: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  has_tables: boolean;
  num_sources: number;
  table_count: number;
  doc_count: number;
  error?: string;
}

export interface HistoryItem {
  timestamp: string;
  question: string;
  answer: string;
  sources: string[];
}
