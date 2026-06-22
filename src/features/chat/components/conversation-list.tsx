import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useIsMobile } from '@/shared/hooks/use-media-query';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ConversationList() {
  const { t } = useTranslation();
  const {
    conversations,
    currentConversationId,
    startNewConversation,
    switchConversation,
    deleteConversation,
  } = useChatStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      startNewConversation: s.startNewConversation,
      switchConversation: s.switchConversation,
      deleteConversation: s.deleteConversation,
    })),
  );
  const isMobile = useIsMobile();

  return (
    <div data-testid="conversation-list" className="flex flex-col gap-1 p-2">
      <Button
        data-testid="new-conversation"
        className="mb-2 w-full transition-transform hover:-translate-y-px hover:shadow-md"
        onClick={startNewConversation}
      >
        {t('conversation.startNew')}
      </Button>
      {conversations.length === 0 ? (
        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
          {t('conversation.empty')}
        </div>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            data-testid="conversation-item"
            data-conv-id={conv.id}
            className={cn(
              'group flex cursor-pointer items-center rounded-none px-2 py-1.5 text-sm transition-colors',
              conv.id === currentConversationId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={() => switchConversation(conv.id)}
          >
            <span className="min-w-0 flex-1 truncate">{conv.title}</span>
            {isMobile && conv.id !== currentConversationId ? (
              <button
                disabled
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-none opacity-30"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'inline-flex size-6 shrink-0 items-center justify-center rounded-none hover:bg-sidebar-accent',
                      isMobile
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100',
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-36"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    variant="destructive"
                    data-testid="conversation-delete-menu"
                    onClick={() => deleteConversation(conv.id)}
                  >
                    <Trash2 />
                    {t('conversation.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))
      )}
    </div>
  );
}
