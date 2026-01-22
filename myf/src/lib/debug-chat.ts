// Debug utilities for chat history
// You can call these from the browser console if needed

export function debugChatHistory() {
  const STORAGE_KEY = "pbi-chat:conversations";
  const CURRENT_ID_KEY = "pbi-chat:currentId";
  
  const raw = localStorage.getItem(STORAGE_KEY);
  const currentId = localStorage.getItem(CURRENT_ID_KEY);
  
  console.log("=== Chat History Debug Info ===");
  console.log("Current ID:", currentId);
  console.log("Raw storage:", raw);
  
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      console.log("Parsed conversations:", parsed);
      console.log("Number of conversations:", Array.isArray(parsed) ? parsed.length : "Not an array!");
    } catch (e) {
      console.error("Failed to parse conversations:", e);
    }
  }
}

export function clearAllChatHistory() {
  const STORAGE_KEY = "pbi-chat:conversations";
  const CURRENT_ID_KEY = "pbi-chat:currentId";
  
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CURRENT_ID_KEY);
  
  console.log("✅ All chat history cleared! Refresh the page.");
  window.location.reload();
}

// Make these available globally for easy debugging
if (typeof window !== "undefined") {
  (window as any).debugChatHistory = debugChatHistory;
  (window as any).clearAllChatHistory = clearAllChatHistory;
}

