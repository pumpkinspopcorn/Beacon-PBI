import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquarePen,
  Search,
  History,
  MoreVertical,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types/powerbi-chat';
// Removed branding from sidebar per request

interface PowerBISidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onPinConversation: (id: string) => void;
  className?: string;
}

export const PowerBISidebar: React.FC<PowerBISidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate pinned and unpinned
  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const unpinnedConversations = filteredConversations.filter((c) => !c.isPinned);

  // Group by date
  const groupByDate = (convs: Conversation[]) => {
    const groups: Record<string, Conversation[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 days': [],
      'Last 30 days': [],
      Older: [],
    };

    const now = Date.now();
    const oneDay = 86400000;

    convs.forEach((conv) => {
      const age = now - conv.updatedAt;

      if (age < oneDay) {
        groups['Today'].push(conv);
      } else if (age < oneDay * 2) {
        groups['Yesterday'].push(conv);
      } else if (age < oneDay * 7) {
        groups['Last 7 days'].push(conv);
      } else if (age < oneDay * 30) {
        groups['Last 30 days'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  };

  const conversationGroups = groupByDate(unpinnedConversations);

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const isActive = currentConversationId === conv.id;
    const isEditing = editingId === conv.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="relative group"
      >
        {isEditing ? (
          <div className="flex items-center gap-1 px-2 py-2">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="h-8 text-sm"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSaveEdit}
              className="h-8 w-8 shrink-0"
            >
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancelEdit}
              className="h-8 w-8 shrink-0"
            >
              <X className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => onSelectConversation(conv.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors',
              'hover:bg-white/10',
              isActive && 'bg-white/20 hover:bg-white/20'
            )}
          >
            <History className="w-4 h-4 shrink-0 text-white/90" />
            <span className="flex-1 truncate text-sm text-white">{conv.title}</span>
            {conv.isPinned && <Pin className="w-3 h-3 shrink-0 text-amber-600" />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPinConversation(conv.id)}>
                  <Pin className="w-4 h-4 mr-2" />
                  {conv.isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStartEdit(conv)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteConversation(conv.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div
      className={cn('flex flex-col h-full bg-[hsl(var(--tetra-blue))] text-white', className)}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Icon rail that expands on hover */}
      <div className="p-2">
        <div className="flex flex-col gap-2">
          <Button
            onClick={onNewConversation}
            variant="ghost"
            className={cn('h-10 rounded-lg hover:bg-white/10', expanded ? 'justify-start px-3 w-full' : 'justify-center w-10 p-0')}
            size="sm"
          >
            {expanded ? (
              <SquarePen className="w-5 h-5 text-white" strokeWidth={1.75} />
            ) : (
              <div className="rounded-lg bg-white/10 p-1.5">
                <SquarePen className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
            )}
            {expanded && <span className="ml-2 text-sm text-white">New Chat</span>}
          </Button>
          <Button
            variant="ghost"
            className={cn('h-10 rounded-lg hover:bg-white/10', expanded ? 'justify-start px-3 w-full' : 'justify-center w-10 p-0')}
            size="sm"
          >
            {expanded ? (
              <History className="w-5 h-5 text-white" strokeWidth={1.75} />
            ) : (
              <div className="rounded-lg bg-white/10 p-1.5">
                <History className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
            )}
            {expanded && <span className="ml-2 text-sm text-white">Chat History</span>}
          </Button>
          {expanded ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" strokeWidth={1.75} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/80"
              />
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-lg justify-center hover:bg-white/10">
              <div className="rounded-lg bg-white/10 p-1.5">
                <Search className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
            </Button>
          )}
        </div>
      </div>

      {/* Conversations list (load only when expanded) */}
      {expanded ? (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
          {/* Pinned */}
          {pinnedConversations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wide px-3 mb-2">
                Pinned
              </h3>
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {pinnedConversations.map((conv) => (
                    <ConversationItem key={conv.id} conv={conv} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Recent conversations grouped by date */}
          {Object.entries(conversationGroups).map(
            ([group, convs]) =>
              convs.length > 0 && (
                <div key={group}>
                  {expanded && (
                    <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wide px-3 mb-2">
                      {group}
                    </h3>
                  )}
                  <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                      {convs.map((conv) => (
                        <ConversationItem key={conv.id} conv={conv} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )
          )}

            {filteredConversations.length === 0 && (
              <div className="text-center py-8 text-sm text-white/80">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1" />
      )}

    </div>
  );
};
