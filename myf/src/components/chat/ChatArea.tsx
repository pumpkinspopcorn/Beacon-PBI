import { useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Message } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeCard } from "./WelcomeCard";

interface ChatAreaProps {
  messages: Message[];
  isTyping?: boolean;
}

export function ChatArea({ messages, isTyping }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto scrollbar-thin py-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Card (when no messages) */}
        {messages.length === 0 && !isTyping && (
          <div className="px-4">
            <WelcomeCard />
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} index={index} />
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && <TypingIndicator />}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
