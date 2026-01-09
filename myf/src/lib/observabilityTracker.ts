import { ObservabilityStats, RecentRequest } from "@/types/chat";

// Local storage keys
const OBSERVABILITY_STORAGE_KEY = "pbi-observability-stats";
const RECENT_REQUESTS_STORAGE_KEY = "pbi-recent-requests";

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
      return { ...getDefaultStats(), ...JSON.parse(stored) };
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
      return requests.slice(-limit); // Return last 'limit' items
    }
  } catch (error) {
    console.warn("Failed to load recent requests from localStorage:", error);
  }
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
  const stats = loadObservabilityStats();
  const requests = loadRecentRequests(100);

  // Update summary stats
  stats.summary.total_requests += 1;
  if (success) {
    stats.summary.successful_requests += 1;
  } else {
    stats.summary.failed_requests += 1;
  }
  stats.summary.success_rate = (stats.summary.successful_requests / stats.summary.total_requests) * 100;

  stats.summary.total_tokens_input += inputTokens;
  stats.summary.total_tokens_output += outputTokens;
  stats.summary.total_tokens += inputTokens + outputTokens;

  // Simulate cost calculation (rough estimate: $0.0015 per 1K tokens for input, $0.002 per 1K tokens for output)
  const inputCost = (inputTokens / 1000) * 0.0015;
  const outputCost = (outputTokens / 1000) * 0.002;
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
  stats.by_model[model].tokens_output += outputTokens;
  stats.by_model[model].tokens_total += inputTokens + outputTokens;
  stats.by_model[model].cost_usd += totalCost;

  const modelTotalLatency = stats.by_model[model].average_latency_ms * (stats.by_model[model].requests - 1) + latencyMs;
  stats.by_model[model].average_latency_ms = modelTotalLatency / stats.by_model[model].requests;

  // Add to recent requests
  const recentRequest: RecentRequest = {
    timestamp: new Date().toISOString(),
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    cost: totalCost,
    latency_ms: latencyMs,
    success,
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