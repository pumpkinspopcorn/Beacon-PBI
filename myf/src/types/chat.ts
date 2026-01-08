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

export interface ObservabilityStats {
  summary: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    success_rate: number;
    total_tokens_input: number;
    total_tokens_output: number;
    total_tokens: number;
    total_cost_usd: number;
    average_latency_ms: number;
  };
  by_model: {
    [model: string]: {
      requests: number;
      tokens_input: number;
      tokens_output: number;
      tokens_total: number;
      cost_usd: number;
      average_latency_ms: number;
    };
  };
  hourly_breakdown: Array<{
    hour: string;
    requests: number;
    cost: number;
  }>;
  recent_requests: Array<{
    timestamp: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;
    latency_ms: number;
    success: boolean;
    error?: string;
    user_id?: string;
    session_id?: string;
    agent_name?: string;
  }>;
}

export interface RecentRequest {
  timestamp: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  success: boolean;
  error?: string;
  user_id?: string;
  session_id?: string;
  agent_name?: string;
}
