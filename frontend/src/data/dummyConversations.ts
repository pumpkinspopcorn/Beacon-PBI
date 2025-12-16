import { Conversation, StarterPrompt } from '@/types/powerbi-chat';

// Starter prompts for Power BI - shown to new users
// These prompts are designed to trigger specific agents in the orchestrator
export const starterPrompts: StarterPrompt[] = [
  {
    id: 'prompt-1',
    title: 'Available Reports',
    description: 'View all reports',
    icon: 'FileSearch',
    // Triggers ReportFinderAgent via keywords: "show", "reports", "available"
    prompt: 'Show me all available reports',
  },
  {
    id: 'prompt-2',
    title: 'Performance Issues',
    description: 'Speed up slow reports',
    icon: 'Zap',
    // Triggers InternetAgent for troubleshooting searches
    prompt: 'How can I speed up slow Power BI reports?',
  },
  {
    id: 'prompt-3',
    title: 'Community Help',
    description: 'Search community forums',
    icon: 'Users',
    // Pre-fills input so user can complete their question
    prompt: 'Search the Power BI community for help with: ',
    prefillOnly: true,
  },
  {
    id: 'prompt-4',
    title: 'Data Analytics',
    description: 'Analyze your Power BI data',
    icon: 'BarChart3',
    prompt: 'Help me analyze my Power BI data and create insights',
  },
  {
    id: 'prompt-5',
    title: 'Dashboard Design',
    description: 'Get help with dashboard creation',
    icon: 'Layers',
    prompt: 'How can I design better Power BI dashboards?',
  },
];

// Start with empty conversations - all chats now come from real backend
export const allConversations: Conversation[] = [];
