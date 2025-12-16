import React from "react";
import { motion } from "framer-motion";
import { MessageSquarePlus, Trash2, Activity, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/ui/sidebar";
import { useHealth } from "@/hooks/useHealth";
import tetraPakLogo from "@/images/tetra_pak-logo_brandlogos.net_hnude.png";
import powerBILogo from "@/images/icons8-power-bi-logo-48.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onClearChat: () => void;
  onNewChat: () => void;
  isClearingChat?: boolean;
}

export function Header({ onClearChat, onNewChat, isClearingChat }: HeaderProps) {
  const { data: health, isLoading: healthLoading } = useHealth();
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
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <img
            src={tetraPakLogo}
            alt="Tetra Pak"
            className="h-10 w-auto object-contain"
          />
          
          <div className="hidden sm:block w-0.5 h-8 bg-gradient-to-b from-primary via-secondary to-accent rounded-full" />
          
          {/* Power BI Logo */}
          <img
            src={powerBILogo}
            alt="Power BI"
            className="h-8 w-8 object-contain"
          />
          
          <div className="flex flex-col justify-center leading-tight">
            <h1 className="text-lg lg:text-xl font-bold text-foreground">
              PBI Beacon
            </h1>
            <h2 className="text-sm lg:text-base font-medium text-muted-foreground -mt-0.5">
              Intelligent Document Assistant
            </h2>
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

        {/* Clear History */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isClearingChat}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear History</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear conversation history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all messages in this conversation.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClearChat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear History
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}
