import { motion } from "framer-motion";
import { FileText, Table2, Brain, MessageSquare, AlertTriangle, Zap, Bug, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: AlertTriangle,
    title: "Error Resolution",
    description: "Help you with resolving errors",
    prompt: "Help me resolve an error"
  },
  {
    icon: FileText,
    title: "PowerBI Reports",
    description: "Finding PowerBI Reports",
    prompt: "Help me find PowerBI reports"
  },
  {
    icon: Table2,
    title: "Dashboard",
    description: "Guide you in building dashboards",
    prompt: "Guide me in building a dashboard"
  },
  {
    icon: HelpCircle,
    title: "General Support",
    description: "Get help with any questions",
    prompt: "I need help with something"
  },
];

interface WelcomeCardProps {
  onSendMessage?: (message: string) => void;
  onPopulateInput?: (message: string) => void;
}

export function WelcomeCard({ onSendMessage, onPopulateInput }: WelcomeCardProps) {
  const handleFeatureClick = (prompt: string) => {
    // Use onPopulateInput if available, otherwise fall back to onSendMessage
    if (onPopulateInput) {
      onPopulateInput(prompt);
    } else if (onSendMessage) {
      onSendMessage(prompt);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-2xl mx-auto"
    >
      <Card className="border-border/50 shadow-lg overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500" />
        <CardContent className="p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              👋 Hello! I'm PowerBi Beacon.
            </h2>
            <p className="text-muted-foreground mb-6">
              I can help you with:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.button
                key={feature.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                onClick={() => handleFeatureClick(feature.prompt)}
                className="flex min-w-0 items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors overflow-hidden cursor-pointer text-left border border-transparent hover:border-primary/20"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <feature.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground break-words">
                    {feature.description}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-sm text-muted-foreground text-center italic"
          >
            💡 Click any option above or type your own question below!
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
