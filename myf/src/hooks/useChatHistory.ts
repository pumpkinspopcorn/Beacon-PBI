import { useEffect, useState, useCallback } from "react";
import { Conversation } from "@/types/powerbi-chat";
import { getConversations, getCurrentConversationId, setCurrentConversationId, subscribe } from "@/lib/chatHistory";

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [currentId, setCurrentIdState] = useState<string | null>(() => getCurrentConversationId());

  useEffect(() => {
    const unsub = subscribe((list, id) => {
      setConversations(list);
      setCurrentIdState(id);
    });
    return unsub;
  }, []);

  const setCurrentId = useCallback((id: string) => {
    setCurrentConversationId(id);
    setCurrentIdState(id);
  }, []);

  return { conversations, currentId, setCurrentId };
}
