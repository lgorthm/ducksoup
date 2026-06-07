import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ConversationList() {
  const { t } = useTranslation();
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  return (
    <div className="flex flex-col gap-1 p-2">
      <Button
        className="mb-2 w-full border-border shadow-sm hover:shadow-md"
        onClick={createConversation}
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
            className={cn(
              'group flex cursor-pointer items-center rounded-none px-2 py-1.5 text-sm transition-colors',
              conv.id === currentId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50',
            )}
            onClick={() => switchConversation(conv.id)}
          >
            <span className="min-w-0 flex-1 truncate">{conv.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              title={t('conversation.delete')}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
