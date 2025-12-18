import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { ChatArea } from "@/components/chat/ChatArea";
import { MessageInput } from "@/components/chat/MessageInput";
import { useChat } from "@/hooks/useChat";

const Index = () => {
  const { messages, isTyping, isLoading, sendMessage, clearChat, newChat, isClearingChat } = useChat();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar onNewChat={newChat} />
        
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <Header 
            onClearChat={clearChat} 
            onNewChat={newChat}
            isClearingChat={isClearingChat}
          />
          
          <main className="flex-1 flex flex-col overflow-hidden">
            <ChatArea messages={messages} isTyping={isTyping} />
            <MessageInput 
              onSendMessage={sendMessage} 
              isLoading={isLoading} 
            />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;
