import { motion } from "framer-motion";
import { FileText, Table2, Brain, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Document Analysis",
    description: "Understanding reports and documents",
  },
  {
    icon: Table2,
    title: "Data Insights",
    description: "Analyzing CSV and Excel with formatted tables",
  },
  {
    icon: Brain,
    title: "Contextual Conversations",
    description: "I remember our chat history",
  },
  {
    icon: MessageSquare,
    title: "Business Intelligence",
    description: "Power BI, dashboards, and analytics",
  },
];

export function WelcomeCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-2xl mx-auto"
    >
      <Card className="border-border/50 shadow-lg overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
        <CardContent className="p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              👋 Hello! I'm your intelligent assistant.
            </h2>
            <p className="text-muted-foreground mb-6">
              I can help you explore and understand your documents and data.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex min-w-0 items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors overflow-hidden"
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
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-sm text-muted-foreground text-center italic"
          >
            💡 Try asking about your documents or data files!
          </motion.p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
