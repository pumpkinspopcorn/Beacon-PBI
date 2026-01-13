import React from "react";
import { motion } from "framer-motion";
import { MessageSquarePlus, Activity, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHealth } from "@/hooks/useHealth";
import beaconPbiLogo from "@/images/beacon_pbi_logo 1.png";
import tetraPakLogo from "@/images/tetra_pak-logo_brandlogos.net_hnude.png";
// Removed alert dialog for Clear History to simplify header actions
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
  const { data: health, isLoading: healthLoading } = useHealth();
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
    <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-border bg-card/95 backdrop-blur px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <img
              src={tetraPakLogo}
              alt="Tetra Pak"
              className="h-10 w-auto object-contain drop-shadow-sm"
              loading="lazy"
            />
            <div className="hidden sm:block h-9 w-px bg-slate-300 dark:bg-slate-600" />
            <img
              src={beaconPbiLogo}
              alt="Beacon Power BI"
              className="h-14 w-auto object-contain drop-shadow-sm sm:h-16"
              loading="lazy"
            />
          </div>

          <div className="hidden sm:block h-10 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex flex-col">
            <h1 className="text-lg lg:text-xl font-semibold leading-tight text-[#0c2d52] dark:text-[#dbe7ff]">
              {title}
            </h1>
            <p className="text-xs lg:text-sm leading-tight text-amber-600 dark:text-amber-400">
              {subtitle}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        {/* Health Badge */}
        {!healthLoading && health && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden md:flex"
          >
            <Badge
              variant={health.status === "healthy" ? "default" : "destructive"}
              className="gap-1.5"
            >
              <Activity className="h-3 w-3" />
              {health.status === "healthy" ? "Connected" : "Offline"}
            </Badge>
          </motion.div>
        )}

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

            {/* Clear History removed per request */}
          </>
        )}
      </div>
    </header>
  );
}
