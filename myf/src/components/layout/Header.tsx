import React from "react";
import { motion } from "framer-motion";
import { MessageSquarePlus, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import tetraPakLogo from "@/images/tetra_pak-logo_brandlogos.net_hnude.png";
import ourLogo from "@/images/ourlogo_edited.PNG";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onClearChat?: () => void;
  onNewChat?: () => void;
  isClearingChat?: boolean;
  title?: string;
  subtitle?: string;
  showChatActions?: boolean;
}

export function Header({ 
  onClearChat, 
  onNewChat, 
  isClearingChat,
  title = "PBI Beacon",
  subtitle = "Intelligent PowerBI Assistant",
  showChatActions = true
}: HeaderProps) {
  const { open } = useSidebar();
  const [darkMode, setDarkMode] = React.useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark";
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <header className="sticky top-0 z-50 flex h-24 items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          {/* Tetra Pak Logo */}
          <img
            src={tetraPakLogo}
            alt="Tetra Pak"
            className="h-16 w-auto object-contain scale-125"
          />
          
          {/* Vertical line separator - Solid Blue with more spacing */}
          <div className="hidden sm:block h-14 w-0.5 bg-blue-500 ml-2" />
          
          {/* Our Logo (Beacon PBI) */}
          <img
            src={ourLogo}
            alt="PBI Beacon"
            className="h-16 w-auto object-contain scale-125"
          />
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setDarkMode((v) => !v)}
          className="h-9 w-9"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Chat Actions - only show if enabled */}
        {showChatActions && (
          <>
            {/* New Chat */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onNewChat}
                  className="h-9 w-9"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Chat</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  );
}
