// Core message types
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'streaming' | 'complete' | 'error';
export type AttachmentType = 'pbix' | 'csv' | 'xlsx' | 'json' | 'png' | 'jpg' | 'pdf';

// File attachment interface
export interface FileAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  size: number;
  url?: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'complete' | 'error';
  previewUrl?: string;
}

// Referenced source
export interface ReferencedSource {
  id: string;
  type: 'table' | 'doc' | 'chart' | 'file';
  name: string;
  path?: string;
  icon?: string;
  metadata?: Record<string, any>;
}

// Table data structures
export interface TableColumn {
  id: string;
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'percentage';
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface TableData {
  id: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
  totalRows: number;
  title?: string;
  description?: string;
}

// Chart data structures
export type ChartType = 'bar' | 'column' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'histogram' | 'kpi';

export interface ChartData {
  id: string;
  type: ChartType;
  title?: string;
  description?: string;
  data: any[];
  config?: {
    xAxis?: string;
    yAxis?: string;
    series?: string[];
    colors?: string[];
  };
}

// Message content blocks
export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  fileName?: string;
}

export interface ImageBlock {
  id: string;
  url: string;
  alt: string;
  caption?: string;
}

// Message metadata
export interface MessageMetadata {
  responseTime?: number;
  citationCount?: number;
  confidence?: number;
  model?: string;
  tokenCount?: number;
}

// Main message interface
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: number;
  
  // Optional content blocks
  attachments?: FileAttachment[];
  tables?: TableData[];
  charts?: ChartData[];
  codeBlocks?: CodeBlock[];
  images?: ImageBlock[];
  sources?: ReferencedSource[];
  
  // Message state
  isEdited?: boolean;
  editHistory?: string[];
  isLiked?: boolean;
  isDisliked?: boolean;
  feedback?: string;
  isPinned?: boolean;
  isRegeneratedFrom?: string;
  
  // Metadata
  metadata?: MessageMetadata;
  
  // Streaming state
  streamedContent?: string;
  isStreaming?: boolean;
}

// Conversation/Chat types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
  tags?: string[];
  model?: string;
}

// User feedback
export interface MessageFeedback {
  messageId: string;
  type: 'like' | 'dislike';
  reason?: 'not-helpful' | 'incorrect' | 'offensive' | 'other';
  comment?: string;
  timestamp: number;
}

// API request/response types
export interface SendMessageRequest {
  conversationId: string;
  content: string;
  attachments?: FileAttachment[];
  parentMessageId?: string;
}

export interface SendMessageResponse {
  messageId: string;
  conversationId: string;
  status: 'success' | 'error';
  error?: string;
}

export interface RegenerateMessageRequest {
  conversationId: string;
  messageId: string;
}

export interface EditMessageRequest {
  conversationId: string;
  messageId: string;
  newContent: string;
}

export interface UploadFileRequest {
  file: File;
  conversationId?: string;
}

export interface UploadFileResponse {
  attachment: FileAttachment;
  analysisStarted?: boolean;
}

// UI State types
export interface ChatUIState {
  isComposing: boolean;
  isUploading: boolean;
  editingMessageId?: string;
  selectedMessageId?: string;
  sidebarOpen: boolean;
  sourcePanelOpen: boolean;
  expandedTableId?: string;
  expandedChartId?: string;
}

// Debug panel state
export interface DebugState {
  apiLatency: number;
  streamingSpeed: number;
  errorSimulation: boolean;
  uploadFailureRate: number;
  telemetry: {
    messagesSent: number;
    messagesReceived: number;
    likes: number;
    dislikes: number;
    copies: number;
    edits: number;
    regenerations: number;
    uploads: number;
  };
}

// Toast/notification types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

// Starter prompts
export interface StarterPrompt {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  prompt: string;
  // If true, pre-fills the input instead of sending immediately
  prefillOnly?: boolean;
}

// Search/filter
export interface ConversationFilter {
  searchQuery?: string;
  tags?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  hasTables?: boolean;
  hasCharts?: boolean;
  hasAttachments?: boolean;
}

// Export types
export type ExportFormat = 'json' | 'markdown' | 'html' | 'pdf';

export interface ExportOptions {
  conversationId: string;
  format: ExportFormat;
  includeMetadata?: boolean;
  includeAttachments?: boolean;
}
