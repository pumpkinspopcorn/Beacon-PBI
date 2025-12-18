import { MessageSquare, Clock, Settings, HelpCircle, Activity, MessageSquarePlus, PanelLeftClose, PanelLeft, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHealth } from "@/hooks/useHealth";
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
  const { data: health } = useHealth();
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
                size="icon"
                onClick={onNewChat}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
                title="New Chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
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

          {/* Collapsed icon strip */}
          <div className="flex flex-col items-center gap-2 group-data-[collapsible=icon]:flex group-data-[collapsible=offcanvas]:hidden">
            <Button variant="ghost" size="icon" title={open ? "Collapse" : "Expand"} onClick={toggleSidebar} className="h-8 w-8">
              {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" title="New Chat" onClick={onNewChat} className="h-8 w-8">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Search" onClick={() => setActivePanel("search")} className="h-8 w-8">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="History" onClick={() => setActivePanel("history")} className="h-8 w-8">
              <Clock className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
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
                <SidebarMenuButton className="gap-3">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>System Status</span>
          </div>
          <Badge
            variant={health?.status === "healthy" ? "default" : "secondary"}
            className="text-xs"
          >
            {health?.status === "healthy" ? "Online" : "Checking..."}
          </Badge>
        </div>
        {health?.sessions !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {health.sessions} active session{health.sessions !== 1 ? "s" : ""}
          </p>
        )}
      </SidebarFooter>

      {/* Slide-out panels from icon column */}
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
            className="fixed left-14 top-16 z-20 w-72 bg-card border border-border rounded-lg shadow-lg"
          >
            {activePanel === "search" && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Search</span>
                </div>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full h-9 px-3 rounded-md bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            )}
            {activePanel === "history" && (
              <div className="p-3 max-h-64 overflow-y-auto scrollbar-thin">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent history</span>
                </div>
                <ul className="space-y-1">
                  {recentConversations.map((conv) => (
                    <li key={conv.id}>
                      <button
                        onClick={() => {
                          onSelectConversation?.(conv.id);
                          setActivePanel(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                      >
                        {conv.title} · <span className="text-muted-foreground text-xs">{conv.timestamp}</span>
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
