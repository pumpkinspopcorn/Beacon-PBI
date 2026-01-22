import { Conversation, Message } from "@/types/powerbi-chat";

const STORAGE_KEY = "pbi-chat:conversations";
const CURRENT_ID_KEY = "pbi-chat:currentId";

const channel = typeof window !== "undefined" && "BroadcastChannel" in window
  ? new BroadcastChannel("pbi-chat-history")
  : null;

// Custom event for same-tab updates
const CHANGE_EVENT = "pbi-chat-change";

function read(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  if (channel) channel.postMessage({ type: "update", conversations });
  // Trigger custom event for same-tab updates
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getConversations(): Conversation[] {
  const conversations = read();
  // Filter out any corrupted conversations and ensure they have required fields
  const validConversations = conversations.filter((c) => {
    return c && c.id && typeof c.id === 'string' && 
           Array.isArray(c.messages) &&
           typeof c.updatedAt === 'number';
  });
  return validConversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Utility to clean up localStorage if needed
export function cleanupConversations() {
  const conversations = read();
  const validConversations = conversations.filter((c) => {
    return c && c.id && typeof c.id === 'string' && 
           Array.isArray(c.messages) &&
           typeof c.updatedAt === 'number';
  });
  
  if (validConversations.length !== conversations.length) {
    console.log(`Cleaned up ${conversations.length - validConversations.length} corrupted conversations`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validConversations));
  }
  
  return validConversations;
}

export function getConversationById(id: string): Conversation | undefined {
  return read().find((c) => c.id === id);
}

export function getCurrentConversationId(): string | null {
  return localStorage.getItem(CURRENT_ID_KEY);
}

export function setCurrentConversationId(id: string) {
  localStorage.setItem(CURRENT_ID_KEY, id);
  if (channel) channel.postMessage({ type: "select", id });
  // Trigger custom event for same-tab updates
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function upsertConversation(update: Conversation) {
  const list = read();
  const idx = list.findIndex((c) => c.id === update.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...update, updatedAt: Date.now() };
  } else {
    list.unshift({ ...update, createdAt: Date.now(), updatedAt: Date.now() });
  }
  write(list);
}

export function updateMessages(conversationId: string, messages: Message[], title?: string) {
  const list = read();
  const idx = list.findIndex((c) => c.id === conversationId);
  const computedTitle = title ?? (messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Untitled Chat");
  const base: Conversation = {
    id: conversationId,
    title: computedTitle,
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...base, updatedAt: Date.now() };
  } else {
    list.unshift(base);
  }
  write(list);
}

export function deleteConversation(conversationId: string) {
  const list = read();
  const filtered = list.filter((c) => c.id !== conversationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  // If we deleted the current conversation, clear the current ID
  const currentId = getCurrentConversationId();
  if (currentId === conversationId) {
    localStorage.removeItem(CURRENT_ID_KEY);
  }
  
  if (channel) channel.postMessage({ type: "delete", id: conversationId });
  // Trigger custom event for same-tab updates
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export type ChatHistoryListener = (conversations: Conversation[], currentId: string | null) => void;

export function subscribe(listener: ChatHistoryListener) {
  const handler = () => listener(getConversations(), getCurrentConversationId());
  
  // Listen to custom events (same-tab updates)
  window.addEventListener(CHANGE_EVENT, handler);
  
  // Listen to storage events (cross-tab updates)
  window.addEventListener("storage", handler);
  
  // Listen to broadcast channel (cross-tab updates)
  if (channel) channel.addEventListener("message", handler as any);
  
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
    if (channel) channel.removeEventListener("message", handler as any);
  };
}
