import { MessageSquare, History, Settings2, LifeBuoy, PanelLeftClose, PanelLeft, Search, BarChart3, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";
import { useChatHistory } from "@/hooks/useChatHistory";

interface ConversationItem {
  id: string;
  title: string;
  timestamp: string;
  isActive?: boolean;
}

interface AppSidebarProps {
  conversations?: ConversationItem[];
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void; // kept for compatibility, not used here
}

export function AppSidebar({ conversations = [], onSelectConversation }: AppSidebarProps) {
  const { toggleSidebar, open } = useSidebar();
  const [activePanel, setActivePanel] = React.useState<null | "search" | "history">(null);
  const location = useLocation();
  const isObservability = location.pathname.startsWith("/observability");
  const navigate = useNavigate();
  const { conversations: history, setCurrentId, currentId, deleteChat } = useChatHistory();

  // Default recent conversations for demo
  const recentConversations: ConversationItem[] = (history.length > 0
    ? history.map((c) => ({ id: c.id, title: c.title || "Untitled Chat", timestamp: new Date(c.updatedAt).toLocaleTimeString(), isActive: c.id === currentId }))
    : [{ id: "current", title: "Current Session", timestamp: "Now", isActive: true }]);

  const handleDeleteChat = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    console.log("Attempting to delete chat:", convId);
    if (window.confirm("Are you sure you want to delete this chat?")) {
      deleteChat(convId);
      console.log("Chat deleted:", convId);
      // If we deleted the current chat, create a new one
      if (convId === currentId) {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setCurrentId(newId);
        navigate("/");
      }
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex flex-col gap-2">
          {/* Top bar */}
          <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <h2 className="font-semibold text-sidebar-foreground text-sm tracking-wide">Chats</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm hover:text-sidebar-foreground transition-all duration-200 rounded-md"
                title={open ? "Close Sidebar" : "Open Sidebar"}
              >
                {open ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded mode quick toggles removed to restore original structure */}

          {/* Collapsed mode - icon column */}
          <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="relative h-10 w-10 text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm hover:text-sidebar-foreground transition-all duration-200 rounded-lg"
              title="Expand Sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActivePanel(activePanel === "search" ? null : "search")}
              className={`relative h-10 w-10 transition-all duration-200 rounded-lg ${activePanel === "search" ? "bg-white/40 backdrop-blur-sm text-sidebar-foreground" : "text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm"}`}
              title="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActivePanel(activePanel === "history" ? null : "history")}
              className={`relative h-10 w-10 transition-all duration-200 rounded-lg ${activePanel === "history" ? "bg-white/40 backdrop-blur-sm text-sidebar-foreground" : "text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm"}`}
              title="History"
            >
              <History className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              asChild
              className={`relative h-10 w-10 transition-all duration-200 rounded-lg ${isObservability ? "bg-white/40 backdrop-blur-sm text-sidebar-foreground" : "text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm"}`}
              title="Analytics"
            >
              <Link to="/observability">
                <BarChart3 className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm hover:text-sidebar-foreground transition-all duration-200 rounded-lg"
              title="Help"
            >
              <LifeBuoy className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-sidebar-foreground hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30 hover:shadow-sm hover:text-sidebar-foreground transition-all duration-200 rounded-lg"
              title="Settings"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin group-data-[collapsible=icon]:hidden">
        {/* Recent Conversations */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/80">
            Recent Chats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentConversations.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <div className="relative group">
                  <SidebarMenuButton
                    isActive={conv.isActive}
                    onClick={() => {
                      console.log("Selecting conversation:", conv.id);
                      if (conv.id !== "current") {
                        setCurrentId(conv.id);
                      }
                      navigate("/");
                      onSelectConversation?.(conv.id);
                    }}
                      className="gap-3 px-4 py-4 pb-6 rounded-md transition-shadow hover:shadow-sm hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-sidebar-foreground">{conv.title}</p>
                        <p className="text-xs text-sidebar-foreground/80 flex items-center gap-1">
                          <History className="h-3 w-3" />
                          {conv.timestamp}
                        </p>
                      </div>
                    </SidebarMenuButton>
                    {conv.id !== "current" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteChat(e, conv.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        title="Delete chat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Links */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/80">
            Quick Links
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="gap-3 px-4 py-4 pb-6 rounded-md transition-shadow hover:shadow-sm hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30">
                  <LifeBuoy className="h-4 w-4" />
                  <span>Help & Tips</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="gap-3 px-4 py-4 pb-6 rounded-md transition-shadow hover:shadow-sm hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30" isActive={isObservability}>
                  <Link to="/observability">
                    <BarChart3 className="h-4 w-4" />
                    <span>Observability</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="gap-3 px-4 py-4 pb-6 rounded-md transition-shadow hover:shadow-sm hover:bg-white/30 hover:backdrop-blur-sm hover:border hover:border-white/30">
                  <Settings2 className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:hidden" />

      {/* Slide-out panels */}
      <AnimatePresence>
        {activePanel && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.2, 0.9, 0.2, 1] }}
            role="dialog"
            aria-modal="false"
            tabIndex={0}
            onBlur={() => setActivePanel(null)}
            onMouseLeave={() => setActivePanel(null)}
            className="fixed left-64 top-20 z-20 w-80 bg-card border border-border rounded-lg shadow-lg"
          >
            {activePanel === "search" && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Search Conversations</span>
                </div>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full h-10 px-3 rounded-md bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">Search through your chat history</p>
              </div>
            )}
            {activePanel === "history" && (
              <div className="p-4 max-h-80 overflow-y-auto scrollbar-thin">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent Conversations</span>
                </div>
                <ul className="space-y-1">
                  {recentConversations.map((conv) => (
                    <li key={conv.id} className="relative group">
                      <button
                        onClick={() => {
                          if (conv.id !== "current") {
                            setCurrentId(conv.id);
                          }
                          navigate("/");
                          onSelectConversation?.(conv.id);
                          setActivePanel(null);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-all duration-200 flex items-center gap-2"
                      >
                        <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{conv.title}</div>
                          <div className="text-xs text-muted-foreground">{conv.timestamp}</div>
                        </div>
                      </button>
                      {conv.id !== "current" && (
                        <button
                          onClick={(e) => {
                            handleDeleteChat(e, conv.id);
                            setActivePanel(null);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 rounded-md flex items-center justify-center"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sidebar>
  );
}
