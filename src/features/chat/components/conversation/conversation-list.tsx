import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { useIsMobile } from '@/shared/hooks/use-media-query';
import { deleteConversation, startNewConversation } from '@/stores/actions';
import { useConversationListState } from '@/stores/selectors';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';
import { ConversationListItem } from './conversation-list-item';
import { DeleteConversationDialog } from './delete-conversation-dialog';

export function ConversationList() {
  const { t } = useTranslation();
  const { conversations, currentConversationId, initialized } =
    useConversationListState();
  const isMobile = useIsMobile();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // initialized 到达时若不足最短展示时长，等剩余时间再切换到列表
  const { revealed, wasLoading: showedSkeleton } =
    useMinLoadingDisplay(initialized);

  const handleConfirmDelete = () => {
    if (pendingDeleteId !== null) {
      deleteConversation(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  return (
    <div data-testid="conversation-list" className="flex flex-col gap-1 p-2">
      <Button
        data-testid="new-conversation"
        className="mb-2 w-full rounded-3xl transition-transform hover:-translate-y-px hover:shadow-md"
        onClick={startNewConversation}
      >
        {t('conversation.startNew')}
      </Button>
      {!revealed ? (
        <div
          data-testid="conversation-list-loading"
          className="flex flex-col gap-1"
        >
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
        </div>
      ) : conversations.length === 0 ? (
        <div
          className={cn(
            'px-2 py-4 text-center text-xs text-muted-foreground',
            showedSkeleton && 'animate-in fade-in-0 duration-300',
          )}
        >
          {t('conversation.empty')}
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-1',
            showedSkeleton && 'animate-in fade-in-0 duration-300',
          )}
        >
          {conversations.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              isMobile={isMobile}
              onRequestDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}
      <DeleteConversationDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
