import { loadObservabilityStats, loadRecentRequests, recordChatRequest, resetLocalObservabilityStats } from "./observabilityTracker";

const API_BASE_URL = "/api";

export interface AskQuestionResponse {
  answer: string;
  session_id: string;
  sources?: Array<{
    id?: string;
    name?: string;
    filename?: string;
    path?: string;
    type?: string;
    is_table?: boolean;
    domain?: string;
    clickable?: boolean;
    chunks?: Array<{
      chunk_id: string;
      page: number | null;
      text: string;
    }>;
    chunk_data?: {
      chunk_id: string;
      page: number | null;
      text: string;
    };
  }>;
  citations?: Array<{
    id?: string;
    text?: string;
    url?: string;
    domain?: string;
    type?: string;
  }>;
}

/**
 * Sends a question to the backend agent.
 */
export async function askQuestion(question: string): Promise<AskQuestionResponse> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      question: question,
      user_id: "web_user",
      session_id: "web_session_001"
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Record the failed request for observability
    recordChatRequest(question, undefined, false);
    
    throw new Error(errorData.detail || "Failed to get response from agent");
  }

  const data = await response.json();
  
  // DEBUG: Log the raw API response
  console.log('[API] Raw response from backend:', JSON.stringify(data, null, 2));
  console.log('[API] Sources in response:', data.sources);
  if (data.sources && data.sources.length > 0) {
    data.sources.forEach((source: any, i: number) => {
      console.log(`[API] Source ${i} FULL OBJECT:`, JSON.stringify(source, null, 2));
      console.log(`[API] Source ${i} keys:`, Object.keys(source));
      console.log(`[API] Source ${i} chunks:`, source.chunks);
      console.log(`[API] Source ${i} chunk_data:`, source.chunk_data);
    });
  }

  // Record the successful request for observability
  recordChatRequest(question, data.answer, true);

  return data;
}

/**
 * Health check for the backend server.
 */
export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) throw new Error("Backend is offline");
  return response.json();
}

/**
 * Get observability statistics.
 * Falls back to local storage if backend is unavailable.
 */
export async function getObservabilityStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/observability/stats`);
    if (!response.ok) throw new Error("Backend observability not available");
    return response.json();
  } catch (error) {
    console.warn("Backend observability not available, using local data:", error);
    // Fall back to local storage data
    return loadObservabilityStats();
  }
}

/**
 * Get recent requests.
 * Falls back to local storage if backend is unavailable.
 */
export async function getRecentRequests(limit: number = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/observability/recent?limit=${limit}`);
    if (!response.ok) throw new Error("Backend recent requests not available");
    return response.json();
  } catch (error) {
    console.warn("Backend recent requests not available, using local data:", error);
    // Fall back to local storage data
    return loadRecentRequests(limit);
  }
}

/**
 * Clear chat history (placeholder - not implemented on backend yet).
 */
export async function clearHistory() {
  // For now, just return success since we're clearing locally
  return { success: true };
}

/**
 * Reset observability statistics.
 * Resets both backend and local data.
 */
export async function resetObservabilityStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/observability/reset`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to reset backend stats");
  } catch (error) {
    console.warn("Backend reset failed, resetting local data only:", error);
  }
  
  // Always reset local data
  resetLocalObservabilityStats();
  
  return { success: true };
}
