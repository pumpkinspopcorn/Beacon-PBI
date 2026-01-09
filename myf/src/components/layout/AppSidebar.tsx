import { MessageSquare, Clock, Settings, HelpCircle, MessageSquarePlus, PanelLeftClose, PanelLeft, Search, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
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

interface ConversationItem {
  id: string;
  title: string;
  timestamp: string;
  isActive?: boolean;
}

interface AppSidebarProps {
  conversations?: ConversationItem[];
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
}

export function AppSidebar({ conversations = [], onSelectConversation, onNewChat }: AppSidebarProps) {
  const { toggleSidebar, open } = useSidebar();
  const [activePanel, setActivePanel] = React.useState<null | "search" | "history">(null);

  // Default recent conversations for demo
  const recentConversations: ConversationItem[] = conversations.length > 0 
    ? conversations 
    : [
        { id: "1", title: "Current Session", timestamp: "Now", isActive: true },
      ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
            <h2 className="font-semibold text-sidebar-foreground text-sm">Chats</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewChat}
                className="h-8 px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 flex items-center gap-2"
                title="New Chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span className="text-sm">New Chat</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
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

          {/* Collapsed mode - show only icons (ChatGPT style) */}
          <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleSidebar} 
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="Expand Sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onNewChat} 
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="New Chat"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setActivePanel(activePanel === "search" ? null : "search")} 
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setActivePanel(activePanel === "history" ? null : "history")} 
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="History"
            >
              <Clock className="h-5 w-5" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              asChild
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="Analytics"
            >
              <Link to="/observability">
                <BarChart3 className="h-5 w-5" />
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin group-data-[collapsible=icon]:hidden">
        {/* Recent Conversations */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Recent Chats
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentConversations.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    isActive={conv.isActive}
                    onClick={() => onSelectConversation?.(conv.id)}
                    className="gap-3"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{conv.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {conv.timestamp}
                      </p>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Links */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Quick Links
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="gap-3">
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & Tips</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="gap-3">
                  <Link to="/observability">
                    <BarChart3 className="h-4 w-4" />
                    <span>Observability</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="gap-3">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:hidden">
        {/* System status removed */}
      </SidebarFooter>

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
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent Conversations</span>
                </div>
                <ul className="space-y-1">
                  {recentConversations.map((conv) => (
                    <li key={conv.id}>
                      <button
                        onClick={() => {
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
