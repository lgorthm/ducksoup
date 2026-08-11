import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useIsMobile } from '@/shared/hooks/use-media-query';
import {
  deleteConversation,
  startNewConversation,
  switchConversation,
} from '@/stores/actions';
import { useConversationListState } from '@/stores/selectors';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';

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
            <div
              key={conv.id}
              data-testid="conversation-item"
              data-conv-id={conv.id}
              className={cn(
                'group/item flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-sm transition-colors',
                conv.id === currentConversationId
                  ? 'bg-amber-400/15 text-sidebar-accent-foreground dark:bg-sidebar-accent'
                  : 'hover:bg-sidebar-accent/50',
              )}
              onClick={() => switchConversation(conv.id)}
            >
              <span className="min-w-0 flex-1 truncate">{conv.title}</span>
              {isMobile && conv.id !== currentConversationId ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg opacity-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          'inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-sidebar-accent-foreground/15',
                          isMobile || conv.id === currentConversationId
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/item:opacity-100',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-36"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid="conversation-delete-menu"
                      onClick={() => setPendingDeleteId(conv.id)}
                    >
                      <Trash2 />
                      {t('conversation.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('conversation.delete')}</DialogTitle>
            <DialogDescription>
              {t('conversation.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-delete-conversation"
              onClick={handleConfirmDelete}
            >
              {t('conversation.deleteConfirmBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
