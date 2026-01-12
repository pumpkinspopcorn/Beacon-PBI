import { 
  Message, 
  Conversation, 
  FileAttachment, 
  SendMessageRequest, 
  SendMessageResponse,
  RegenerateMessageRequest,
  EditMessageRequest,
  UploadFileRequest,
  UploadFileResponse,
  MessageFeedback
} from '@/types/powerbi-chat';

// Mock delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Mock telemetry data
let telemetryData = {
  messagesSent: 0,
  messagesReceived: 0,
  likes: 0,
  dislikes: 0,
  copies: 0,
  edits: 0,
  regenerations: 0,
  uploads: 0,
};

// Mock send message function
export const mockSendMessage = async (request: SendMessageRequest): Promise<SendMessageResponse> => {
  await delay(500); // Simulate network delay
  
  telemetryData.messagesSent++;
  
  try {
    // Simulate success response
    return {
      messageId: generateId(),
      conversationId: request.conversationId,
      status: 'success'
    };
  } catch (error) {
    return {
      messageId: generateId(),
      conversationId: request.conversationId,
      status: 'error',
      error: 'Failed to send message'
    };
  }
};

// Mock regenerate message function
export const mockRegenerateMessage = async (request: RegenerateMessageRequest): Promise<Message> => {
  await delay(800); // Simulate processing time
  
  telemetryData.regenerations++;
  
  const regeneratedMessage: Message = {
    id: generateId(),
    role: 'assistant',
    content: 'This is a regenerated response with different content.',
    status: 'complete',
    timestamp: Date.now(),
    isRegeneratedFrom: request.messageId,
    metadata: {
      responseTime: 800,
      model: 'groq/llama-3.1-70b-versatile',
      tokenCount: 150
    }
  };
  
  return regeneratedMessage;
};

// Mock upload file function
export const mockUploadFile = async (request: UploadFileRequest): Promise<UploadFileResponse> => {
  await delay(1000); // Simulate upload time
  
  telemetryData.uploads++;
  
  const attachment: FileAttachment = {
    id: generateId(),
    name: request.file.name,
    type: getFileType(request.file.name),
    size: request.file.size,
    uploadStatus: 'complete',
    uploadProgress: 100,
    url: URL.createObjectURL(request.file)
  };
  
  return {
    attachment,
    analysisStarted: true
  };
};

// Mock edit message function
export const mockEditMessage = async (request: EditMessageRequest): Promise<Message> => {
  await delay(300);
  
  telemetryData.edits++;
  
  // Return updated message
  const editedMessage: Message = {
    id: request.messageId,
    role: 'user',
    content: request.newContent,
    status: 'complete',
    timestamp: Date.now(),
    isEdited: true,
    editHistory: [request.newContent]
  };
  
  return editedMessage;
};

// Mock submit feedback function
export const mockSubmitFeedback = async (feedback: MessageFeedback): Promise<void> => {
  await delay(200);
  
  if (feedback.type === 'like') {
    telemetryData.likes++;
  } else {
    telemetryData.dislikes++;
  }
  
  console.log('Feedback submitted:', feedback);
};

// Track telemetry function
export const trackTelemetry = (action: string, data?: any) => {
  switch (action) {
    case 'copy':
      telemetryData.copies++;
      break;
    case 'message_received':
      telemetryData.messagesReceived++;
      break;
    default:
      console.log('Telemetry tracked:', action, data);
  }
};

// Get telemetry data
export const getTelemetryData = () => ({ ...telemetryData });

// Reset telemetry data
export const resetTelemetryData = () => {
  telemetryData = {
    messagesSent: 0,
    messagesReceived: 0,
    likes: 0,
    dislikes: 0,
    copies: 0,
    edits: 0,
    regenerations: 0,
    uploads: 0,
  };
};

// Helper function to determine file type
function getFileType(fileName: string): FileAttachment['type'] {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pbix':
      return 'pbix';
    case 'csv':
      return 'csv';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'json':
      return 'json';
    case 'png':
      return 'png';
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'pdf':
      return 'pdf';
    default:
      return 'json'; // Default fallback
  }
}