import { Conversation, Message } from "@/types/powerbi-chat";

const STORAGE_KEY = "pbi-chat:conversations";
const CURRENT_ID_KEY = "pbi-chat:currentId";

const channel = typeof window !== "undefined" && "BroadcastChannel" in window
  ? new BroadcastChannel("pbi-chat-history")
  : null;

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
}

export function getConversations(): Conversation[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
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

export type ChatHistoryListener = (conversations: Conversation[], currentId: string | null) => void;

export function subscribe(listener: ChatHistoryListener) {
  const handler = () => listener(getConversations(), getCurrentConversationId());
  window.addEventListener("storage", handler);
  if (channel) channel.addEventListener("message", handler as any);
  return () => {
    window.removeEventListener("storage", handler);
    if (channel) channel.removeEventListener("message", handler as any);
  };
}
