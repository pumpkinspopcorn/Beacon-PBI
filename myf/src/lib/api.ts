/**
 * API client for communicating with the backend FastAPI server.
 */

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
export async function askQuestion(question: string, session_id?: string): Promise<AskQuestionResponse> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      question,
      session_id: session_id || "web_session_001"
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to get response from agent");
  }

  return response.json();
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
 */
export async function getObservabilityStats() {
  const response = await fetch(`${API_BASE_URL}/observability/stats`);
  if (!response.ok) throw new Error("Failed to fetch observability stats");
  return response.json();
}

/**
 * Get recent requests.
 */
export async function getRecentRequests(limit: number = 50) {
  const response = await fetch(`${API_BASE_URL}/observability/recent?limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch recent requests");
  return response.json();
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
 */
export async function resetObservabilityStats() {
  const response = await fetch(`${API_BASE_URL}/observability/reset`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to reset stats");
  return response.json();
}
