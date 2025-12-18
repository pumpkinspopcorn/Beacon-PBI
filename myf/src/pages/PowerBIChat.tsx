import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Loader2, Sun, Moon } from 'lucide-react';
import TetraLogo from '../assets/tetra-pak-logo.png';
import OurLogo from '../assets/ourlogo.png';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Message, Conversation, FileAttachment } from '@/types/powerbi-chat';
import { starterPrompts } from '@/data/dummyConversations';
import {
  mockSendMessage,
  mockRegenerateMessage,
  mockUploadFile,
  mockEditMessage,
  mockSubmitFeedback,
  trackTelemetry,
} from '@/lib/mockAPI';
import { askQuestion } from '@/lib/api';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { PowerBISidebar } from '@/components/chat/PowerBISidebar';
import { EmptyState } from '@/components/chat/EmptyState';

export default function PowerBIChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [prefillText, setPrefillText] = useState<string>('');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  // Auto-select first conversation on mount
  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [currentConversation?.messages]);

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setSidebarOpen(false);
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, title: newTitle } : conv))
    );
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(conversations[0]?.id || null);
    }
  };

  const handlePinConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, isPinned: !conv.isPinned } : conv))
    );
  };

  const updateConversationMessages = (convId: string, updater: (messages: Message[]) => Message[]) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === convId
          ? { ...conv, messages: updater(conv.messages), updatedAt: Date.now() }
          : conv
      )
    );
  };

  const handleSendMessage = async (content: string, attachments: FileAttachment[]) => {
    if (!currentConversationId) return;

    trackTelemetry('messagesSent');

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      status: 'complete',
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Add user message
    updateConversationMessages(currentConversationId, (messages) => [...messages, userMessage]);

    // Update conversation title if it's the first message
    if (currentConversation && currentConversation.messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      handleRenameConversation(currentConversationId, title);
    }

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: Date.now(),
      isStreaming: true,
    };

    updateConversationMessages(currentConversationId, (messages) => [...messages, assistantMessage]);

    setIsStreaming(true);

    try {
      let fullContent = '';

      // Try real API first, fallback to mock if it fails
      try {
        const response = await askQuestion(content);
        fullContent = response.answer;
        
        // Convert sources to ReferencedSource format
        const referencedSources = response.sources.map((source, index) => ({
          id: `source-${Date.now()}-${index}`,
          type: 'file' as const,
          name: source.filename || source.path,
          path: source.path,
          metadata: {
            type: source.type,
            is_table: source.is_table,
          },
        }));

        // Update message with response
        updateConversationMessages(currentConversationId, (messages) =>
          messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: fullContent,
                  status: 'complete',
                  isStreaming: false,
                  sources: referencedSources,
                  metadata: {
                    responseTime: Math.random() * 3 + 1,
                    citationCount: referencedSources.length,
                  },
                }
              : msg
          )
        );
      } catch (apiError) {
        // Fallback to mock API if real API fails
        console.warn('Real API failed, using mock:', apiError);
        await mockSendMessage(
          {
            conversationId: currentConversationId,
            content,
            attachments,
          },
          (chunk, full) => {
            fullContent = full;
            updateConversationMessages(currentConversationId, (messages) =>
              messages.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: full, streamedContent: full }
                  : msg
              )
            );
          }
        );

        // Mark as complete
        updateConversationMessages(currentConversationId, (messages) =>
          messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  status: 'complete',
                  isStreaming: false,
                  metadata: {
                    responseTime: Math.random() * 3 + 1,
                    citationCount: 0,
                  },
                }
              : msg
          )
        );
      }

      trackTelemetry('messagesReceived');
    } catch (error: any) {
      updateConversationMessages(currentConversationId, (messages) =>
        messages.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, status: 'error', isStreaming: false } : msg
        )
      );

      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAttachFile = async (file: File): Promise<FileAttachment> => {
    trackTelemetry('uploads');

    return new Promise((resolve, reject) => {
      mockUploadFile(
        { file },
        (progress) => {
          // Could show progress in UI
        }
      )
        .then((response) => {
          toast({
            title: 'File uploaded',
            description: `${file.name} uploaded successfully`,
          });
          resolve(response.attachment);
        })
        .catch((error) => {
          toast({
            title: 'Upload failed',
            description: error.message,
            variant: 'destructive',
          });
          reject(error);
        });
    });
  };

  const handleLike = (messageId: string) => {
    if (!currentConversationId) return;

    trackTelemetry('likes');

    updateConversationMessages(currentConversationId, (messages) =>
      messages.map((msg) =>
        msg.id === messageId ? { ...msg, isLiked: true, isDisliked: false } : msg
      )
    );

    mockSubmitFeedback({
      messageId,
      type: 'like',
      timestamp: Date.now(),
    });

    toast({
      title: 'Feedback recorded',
      description: 'Thank you for your feedback!',
      duration: 2000,
    });
  };

  const handleDislike = (messageId: string, reason?: string, comment?: string) => {
    if (!currentConversationId) return;

    trackTelemetry('dislikes');

    updateConversationMessages(currentConversationId, (messages) =>
      messages.map((msg) =>
        msg.id === messageId ? { ...msg, isDisliked: true, isLiked: false, feedback: comment } : msg
      )
    );

    mockSubmitFeedback({
      messageId,
      type: 'dislike',
      reason: reason as any,
      comment,
      timestamp: Date.now(),
    });

    toast({
      title: 'Feedback submitted',
      description: 'We\'ll use this to improve our responses',
      duration: 2000,
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    trackTelemetry('copies');

    toast({
      title: 'Copied',
      description: 'Message copied to clipboard',
    });
  };

  const handleRegenerate = async (messageId: string) => {
    if (!currentConversationId) return;

    trackTelemetry('regenerations');
    setRegeneratingMessageId(messageId);

    try {
      let fullContent = '';

      await mockRegenerateMessage(
        {
          conversationId: currentConversationId,
          messageId,
        },
        (chunk, full) => {
          fullContent = full;
          updateConversationMessages(currentConversationId, (messages) =>
            messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: full, streamedContent: full, isStreaming: true }
                : msg
            )
          );
        }
      );

      updateConversationMessages(currentConversationId, (messages) =>
        messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                isStreaming: false,
                isRegeneratedFrom: messageId,
                metadata: {
                  ...msg.metadata,
                  responseTime: Math.random() * 3 + 1,
                },
              }
            : msg
        )
      );

      toast({
        title: 'Response regenerated',
        description: 'Generated a new response',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  const handleEdit = (messageId: string) => {
    setEditingMessageId(messageId);
  };

  const handleSaveEdit = async (content: string) => {
    if (!currentConversationId || !editingMessageId) return;

    trackTelemetry('edits');

    const originalMessage = currentConversation?.messages.find((m) => m.id === editingMessageId);
    // Determine the assistant message to regenerate BEFORE mutating state
    const editedIndex = currentConversation?.messages.findIndex((m) => m.id === editingMessageId) ?? -1;
    const nextAssistantId = editedIndex >= 0
      ? (currentConversation?.messages.slice(editedIndex + 1).find((m) => m.role === 'assistant')?.id)
      : undefined;

    try {
      await mockEditMessage({
        conversationId: currentConversationId,
        messageId: editingMessageId,
        newContent: content,
      });

      updateConversationMessages(currentConversationId, (messages) =>
        messages.map((msg) =>
          msg.id === editingMessageId
            ? {
                ...msg,
                content,
                isEdited: true,
                editHistory: [...(msg.editHistory || []), originalMessage?.content || ''],
              }
            : msg
        )
      );

      setEditingMessageId(null);

      // After editing a user message, regenerate the subsequent assistant response
      if (nextAssistantId) {
        await handleRegenerate(nextAssistantId);
      } else {
        // If no assistant reply exists yet, send the edited message to get a fresh response
        await handleSendMessage(content, []);
      }

      toast({
        title: 'Message edited',
        description: 'Your message has been updated',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Undo edit
              if (originalMessage) {
                updateConversationMessages(currentConversationId, (messages) =>
                  messages.map((msg) =>
                    msg.id === editingMessageId ? originalMessage : msg
                  )
                );
              }
            }}
          >
            Undo
          </Button>
        ),
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to edit message',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };

  const handleStarterPrompt = (prompt: string) => {
    // Handle special cases
    if (prompt === 'PERFORMANCE_ISSUE_PREFILL') {
      // Pre-fill the text box instead of sending
      if (!currentConversationId) {
        handleNewConversation();
      }
      setPrefillText('What do you have issues with: ');
      return;
    }
    
    if (prompt === 'DAX_GENERATION_MESSAGE') {
      // Send a friendly message asking for details
      const friendlyMessage = "Sure! I'd be happy to help you generate a DAX query. Could you please let me know:\n\n1. What data or calculation you need the DAX query for?\n2. If possible, could you share some sample data or describe the structure of your data?\n\nThis will help me create the most accurate DAX measure for your needs.";
      if (!currentConversationId) {
        handleNewConversation();
        setTimeout(() => {
          handleSendMessage(friendlyMessage, []);
        }, 100);
      } else {
        handleSendMessage(friendlyMessage, []);
      }
      return;
    }
    
    // Regular prompt handling
    if (!currentConversationId) {
      handleNewConversation();
      // Wait for state update
      setTimeout(() => {
        handleSendMessage(prompt, []);
      }, 100);
    } else {
      handleSendMessage(prompt, []);
    }
  };

  const editingMessage = currentConversation?.messages.find((m) => m.id === editingMessageId);

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <AnimatePresence mode="wait">
        {desktopSidebarOpen && (
          <motion.div
            onMouseEnter={() => setSidebarHover(true)}
            onMouseLeave={() => setSidebarHover(false)}
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn('hidden lg:block border-r border-slate-200 flex-shrink-0 mt-16', sidebarHover ? 'w-80' : 'w-14')}
          >
            <PowerBISidebar
              conversations={conversations}
              currentConversationId={currentConversationId || undefined}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onRenameConversation={handleRenameConversation}
              onDeleteConversation={handleDeleteConversation}
              onPinConversation={handlePinConversation}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <PowerBISidebar
            conversations={conversations}
            currentConversationId={currentConversationId || undefined}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onPinConversation={handlePinConversation}
          />
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col pt-16">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-slate-200 flex items-center justify-between px-4 bg-white shadow-sm dark:bg-slate-900">
          <div className="flex items-center gap-4">
            {/* Tetra Pak Logo */}
            <img src={TetraLogo} alt="Tetra Pak" className="h-6 w-auto object-contain" />
            
            {/* Vertical line separator */}
            <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-600" />
            
            {/* Our Logo - slightly left of text */}
            <img src={OurLogo} alt="Logo" className="h-8 w-auto object-contain" />
            
            {/* Text content - stacked vertically */}
            <div className="flex flex-col">
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                PBI Beacon
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                Intelligent PowerBI Assistant
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle dark mode"
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                const root = document.documentElement;
                if (next) root.classList.add('dark'); else root.classList.remove('dark');
                localStorage.setItem('theme', next ? 'dark' : 'light');
              }}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="chat-container max-w-4xl mx-auto w-full px-4 transition-padding">
            {!currentConversation || currentConversation.messages.length === 0 ? (
              <EmptyState starterPrompts={starterPrompts} onSelectPrompt={handleStarterPrompt} />
            ) : (
              <div className="py-4">
                <AnimatePresence mode="popLayout">
                  {currentConversation.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onLike={() => handleLike(message.id)}
                      onDislike={(reason, comment) => handleDislike(message.id, reason, comment)}
                      onCopy={() => handleCopy(message.content)}
                      onRegenerate={
                        message.role === 'assistant' ? () => handleRegenerate(message.id) : undefined
                      }
                      onEdit={message.role === 'user' ? () => handleEdit(message.id) : undefined}
                      showRegenerateLoading={regeneratingMessageId === message.id}
                    />
                  ))}
                </AnimatePresence>

                {/* Typing indicator removed per request */}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Composer */}
        <MessageComposer
          onSendMessage={handleSendMessage}
          onAttachFile={handleAttachFile}
          isStreaming={isStreaming}
          onStopStreaming={() => setIsStreaming(false)}
          editMode={
            editingMessage
              ? {
                  messageId: editingMessage.id,
                  content: editingMessage.content,
                  onSave: handleSaveEdit,
                  onCancel: handleCancelEdit,
                }
              : undefined
          }
          disabled={isStreaming}
          showQuickPrompts={!currentConversation || currentConversation.messages.length === 0}
          quickPrompts={starterPrompts}
          onSelectQuickPrompt={handleStarterPrompt}
          initialValue={prefillText}
          onInitialValueUsed={() => setPrefillText('')}
        />
      </div>

    </div>
  );
}
