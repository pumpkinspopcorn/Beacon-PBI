import { ObservabilityStats, RecentRequest } from "@/types/chat";
import { getConversations } from "./chatHistory";

// Local storage keys
const OBSERVABILITY_STORAGE_KEY = "pbi-observability-stats";
const RECENT_REQUESTS_STORAGE_KEY = "pbi-recent-requests";

const ERROR_PHRASES = [
  "unable to connect to the backend",
  "unable to connect to the backend server",
  "backend server",
  "failed to",
  "error",
  "exception",
  "timeout",
  "apologize",
  "please try again",
];

// Normalize success based on whether the agent actually produced a valid response
const evaluateResponseSuccess = (
  response: string | undefined,
  requestedSuccess: boolean,
): { success: boolean; errorReason?: string } => {
  if (!requestedSuccess) {
    return { success: false, errorReason: response || "Agent did not return a response" };
  }

  const trimmed = response?.trim();
  if (!trimmed) {
    return { success: false, errorReason: "Agent did not return a response" };
  }

  const normalized = trimmed.toLowerCase();
  const isErrorLike = ERROR_PHRASES.some((phrase) => normalized.includes(phrase));
  if (isErrorLike) {
    return { success: false, errorReason: trimmed };
  }

  return { success: true };
};

// Initialize default stats
const getDefaultStats = (): ObservabilityStats => ({
  summary: {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    success_rate: 0,
    total_tokens_input: 0,
    total_tokens_output: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    average_latency_ms: 0,
  },
  by_model: {},
  hourly_breakdown: [],
  recent_requests: [],
});

// Load stats from localStorage
export const loadObservabilityStats = (): ObservabilityStats => {
  try {
    const stored = localStorage.getItem(OBSERVABILITY_STORAGE_KEY);
    if (stored) {
      const parsedStats = JSON.parse(stored);
      // Check if we have meaningful data
      if (parsedStats.summary && parsedStats.summary.total_requests > 0) {
        return { ...getDefaultStats(), ...parsedStats };
      }
    }
  } catch (error) {
    console.warn("Failed to load observability stats from localStorage:", error);
  }

  return getDefaultStats();
};

// Save stats to localStorage
export const saveObservabilityStats = (stats: ObservabilityStats): void => {
  try {
    localStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("Failed to save observability stats to localStorage:", error);
  }
};

// Load recent requests from localStorage
export const loadRecentRequests = (limit: number = 50): RecentRequest[] => {
  try {
    const stored = localStorage.getItem(RECENT_REQUESTS_STORAGE_KEY);
    if (stored) {
      const requests = JSON.parse(stored) as RecentRequest[];
      if (requests.length > 0) {
        return requests.slice(-limit); // Return last 'limit' items
      }
    }
  } catch (error) {
    console.warn("Failed to load recent requests from localStorage:", error);
  }

  // Don't populate recent requests from chat history - only show actual API calls
  // The stats summary can be populated from chat history, but recent requests should be real-time only
  return [];
};

// Save recent requests to localStorage
export const saveRecentRequests = (requests: RecentRequest[]): void => {
  try {
    // Keep only last 100 requests to prevent storage bloat
    const limitedRequests = requests.slice(-100);
    localStorage.setItem(RECENT_REQUESTS_STORAGE_KEY, JSON.stringify(limitedRequests));
  } catch (error) {
    console.warn("Failed to save recent requests to localStorage:", error);
  }
};

// Record a new chat request
export const recordChatRequest = (
  question: string,
  response?: string,
  success: boolean = true,
  latencyMs: number = Math.random() * 2000 + 500, // Random latency between 500-2500ms
  inputTokens: number = Math.floor(Math.random() * 100) + 50, // Random input tokens
  outputTokens: number = Math.floor(Math.random() * 200) + 100 // Random output tokens
): void => {
  console.log('[OBSERVABILITY] Recording chat request:', { question: question.substring(0, 50), success, latencyMs, inputTokens, outputTokens });

  const stats = loadObservabilityStats();
  const requests = loadRecentRequests(100);

  const { success: computedSuccess, errorReason } = evaluateResponseSuccess(response, success);
  const safeOutputTokens = computedSuccess ? outputTokens : 0;

  // Update summary stats
  stats.summary.total_requests += 1;
  if (computedSuccess) {
    stats.summary.successful_requests += 1;
  } else {
    stats.summary.failed_requests += 1;
  }
  stats.summary.success_rate = (stats.summary.successful_requests / stats.summary.total_requests) * 100;

  stats.summary.total_tokens_input += inputTokens;
  stats.summary.total_tokens_output += safeOutputTokens;
  stats.summary.total_tokens += inputTokens + safeOutputTokens;

  // Simulate cost calculation (rough estimate: $0.0015 per 1K tokens for input, $0.002 per 1K tokens for output)
  const inputCost = computedSuccess ? (inputTokens / 1000) * 0.0015 : 0;
  const outputCost = computedSuccess ? (safeOutputTokens / 1000) * 0.002 : 0;
  const totalCost = inputCost + outputCost;
  stats.summary.total_cost_usd += totalCost;

  // Update average latency
  const totalLatency = stats.summary.average_latency_ms * (stats.summary.total_requests - 1) + latencyMs;
  stats.summary.average_latency_ms = totalLatency / stats.summary.total_requests;

  // Update by_model stats (using a default model)
  const model = "gpt-4"; // Default model
  if (!stats.by_model[model]) {
    stats.by_model[model] = {
      requests: 0,
      tokens_input: 0,
      tokens_output: 0,
      tokens_total: 0,
      cost_usd: 0,
      average_latency_ms: 0,
    };
  }
  stats.by_model[model].requests += 1;
  stats.by_model[model].tokens_input += inputTokens;
  stats.by_model[model].tokens_output += safeOutputTokens;
  stats.by_model[model].tokens_total += inputTokens + safeOutputTokens;
  stats.by_model[model].cost_usd += totalCost;

  const modelTotalLatency = stats.by_model[model].average_latency_ms * (stats.by_model[model].requests - 1) + latencyMs;
  stats.by_model[model].average_latency_ms = modelTotalLatency / stats.by_model[model].requests;

  // Add to recent requests
  const recentRequest: RecentRequest = {
    timestamp: new Date().toISOString(),
    model,
    input_tokens: inputTokens,
    output_tokens: safeOutputTokens,
    total_tokens: inputTokens + safeOutputTokens,
    cost: totalCost,
    latency_ms: latencyMs,
    success: computedSuccess,
    error: errorReason,
    user_id: "web_user",
    session_id: "web_session_001",
    agent_name: "pbi-beacon",
  };

  requests.push(recentRequest);
  stats.recent_requests = requests.slice(-50); // Keep last 50 in stats

  // Update hourly breakdown (simplified - just current hour)
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;

  let hourlyEntry = stats.hourly_breakdown.find(h => h.hour === hourKey);
  if (!hourlyEntry) {
    hourlyEntry = { hour: hourKey, requests: 0, cost: 0 };
    stats.hourly_breakdown.push(hourlyEntry);
  }
  hourlyEntry.requests += 1;
  hourlyEntry.cost += totalCost;

  // Keep only last 24 hours
  stats.hourly_breakdown = stats.hourly_breakdown.slice(-24);

  // Save updated data
  saveObservabilityStats(stats);
  saveRecentRequests(requests);
};

// Reset all observability stats
export const resetLocalObservabilityStats = (): void => {
  localStorage.removeItem(OBSERVABILITY_STORAGE_KEY);
  localStorage.removeItem(RECENT_REQUESTS_STORAGE_KEY);
};

// Populate observability stats from existing chat conversations
export const populateStatsFromChatHistory = (): void => {
  const conversations = getConversations();
  if (conversations.length === 0) return;

  const stats = getDefaultStats();
  const requests: RecentRequest[] = [];

  conversations.forEach((conversation, convIndex) => {
    conversation.messages.forEach((message, msgIndex) => {
      if (message.role !== 'user') return;

      const assistantReply = conversation.messages.slice(msgIndex + 1).find(msg => msg.role === 'assistant');
      const responseText = assistantReply?.content;
      const { success } = evaluateResponseSuccess(responseText, true);

      // Generate realistic token counts based on message length
      const inputTokens = Math.max(50, Math.floor(message.content.length / 4) + Math.floor(Math.random() * 50));
      const outputTokens = success ? Math.max(100, Math.floor(inputTokens * 0.8) + Math.floor(Math.random() * 100)) : 0;
      const totalTokens = inputTokens + outputTokens;

      // Calculate costs (only when we have a valid agent response)
      const inputCost = (inputTokens / 1000) * 0.0015;
      const outputCost = (outputTokens / 1000) * 0.002;
      const totalCost = success ? inputCost + outputCost : 0;

      // Generate realistic latency
      const latencyMs = Math.floor(Math.random() * 2000) + 500;

      // Create request record
      const request: RecentRequest = {
        timestamp: new Date(message.timestamp || Date.now() - (convIndex * 3600000) - (msgIndex * 60000)).toISOString(),
        model: "gpt-4",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost: totalCost,
        latency_ms: latencyMs,
        success,
        error: success ? undefined : responseText || "Agent did not return a response",
        user_id: "web_user",
        session_id: `session_${conversation.id}`,
        agent_name: "pbi-beacon",
      };

      requests.push(request);

      // Update summary stats
      stats.summary.total_requests += 1;
      if (success) {
        stats.summary.successful_requests += 1;
      } else {
        stats.summary.failed_requests += 1;
      }
      stats.summary.total_tokens_input += inputTokens;
      stats.summary.total_tokens_output += outputTokens;
      stats.summary.total_tokens += totalTokens;
      stats.summary.total_cost_usd += totalCost;

      // Update by_model stats (aligns with how recordChatRequest stores tokens)
      if (!stats.by_model["gpt-4"]) {
        stats.by_model["gpt-4"] = {
          requests: 0,
          tokens_input: 0,
          tokens_output: 0,
          tokens_total: 0,
          cost_usd: 0,
          average_latency_ms: 0,
        };
      }

      const modelStats = stats.by_model["gpt-4"];
      modelStats.requests += 1;
      modelStats.tokens_input += inputTokens;
      modelStats.tokens_output += outputTokens;
      modelStats.tokens_total += totalTokens;
      modelStats.cost_usd += totalCost;

      const modelTotalLatency = modelStats.average_latency_ms * (modelStats.requests - 1) + latencyMs;
      modelStats.average_latency_ms = modelTotalLatency / modelStats.requests;
    });
  });

  // Calculate derived stats
  stats.summary.success_rate = (stats.summary.successful_requests / Math.max(stats.summary.total_requests, 1)) * 100;
  stats.summary.average_latency_ms = requests.length > 0
    ? requests.reduce((sum, req) => sum + req.latency_ms, 0) / requests.length
    : 0;

  // Add recent requests (skip for historical data - only real API calls should appear in recent requests)
  // stats.recent_requests = requests.slice(-50); // Commented out for historical data

  // Create hourly breakdown (simulate some historical activity)
  const now = new Date();
  for (let i = 0; i < Math.min(conversations.length, 24); i++) {
    const hourDate = new Date(now.getTime() - (i * 60 * 60 * 1000));
    const hourKey = `${hourDate.getFullYear()}-${String(hourDate.getMonth() + 1).padStart(2, '0')}-${String(hourDate.getDate()).padStart(2, '0')} ${String(hourDate.getHours()).padStart(2, '0')}:00`;

    stats.hourly_breakdown.push({
      hour: hourKey,
      requests: Math.floor(Math.random() * 5) + 1, // Random requests per hour
      cost: Math.random() * 0.1, // Random cost per hour
    });
  }

  // Keep only last 24 hours
  stats.hourly_breakdown = stats.hourly_breakdown.slice(-24);

  // Save the populated data (but don't save recent requests for historical data)
  saveObservabilityStats(stats);
  // Don't save recent requests for historical data - only real API calls
  // saveRecentRequests(requests);
};