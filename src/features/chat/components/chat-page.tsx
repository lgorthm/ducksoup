import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ApiKeyDialog } from '@/features/chat/components/api-key-dialog';
import { ChatArea } from '@/features/chat/components/chat-area';
import { useChatStore } from '@/features/chat/store/chat-store';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';

// 模拟真实聊天界面结构的骨架屏：消息列表 max-w-[744px]、输入区 max-w-[776px]
function ChatPageSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex h-full flex-col overflow-hidden"
      data-testid="chat-page-skeleton"
    >
      <span className="sr-only">{t('chat.page.loading')}</span>
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-[744px] flex-1 flex-col gap-6 overflow-hidden px-4 py-6"
      >
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/5 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/3 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <div aria-hidden className="mx-auto w-full max-w-[776px] px-4">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="mx-auto my-2 h-3 w-56" />
      </div>
    </div>
  );
}

function ChatPagePending() {
  const { t } = useTranslation();

  return (
    <div role="status" className="h-full" data-testid="chat-page-pending">
      <span className="sr-only">{t('chat.page.loading')}</span>
    </div>
  );
}

interface ChatPageContentProps {
  initialHasContent: boolean;
}

function ChatPageContent({ initialHasContent }: ChatPageContentProps) {
  const hasApiKey = useChatStore((s) => s.hasApiKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showInitialSkeleton] = useState(initialHasContent);
  const [ready, setReady] = useState(!initialHasContent);
  // 历史内容首次加载时保留最短骨架屏时长；欢迎页路径直接 revealed
  const { revealed } = useMinLoadingDisplay(ready);

  useEffect(() => {
    if (!ready) {
      setReady(true);
    }
  }, [ready]);

  // 首次加载完成后，如果没有 API Key 则弹出设置框
  const needShowKeyDialog = revealed && !hasApiKey;
  const dialogIsOpen = needShowKeyDialog || dialogOpen;

  if (showInitialSkeleton && !revealed) {
    return <ChatPageSkeleton />;
  }

  return (
    <div className="h-full animate-in fade-in-0 duration-300">
      <ChatArea />
      <ApiKeyDialog open={dialogIsOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export function ChatPage() {
  const { init, initialized, hasContent } = useChatStore(
    useShallow((s) => ({
      init: s.init,
      initialized: s.initialized,
      hasContent: s.messages.length > 0 || s.streamingMessage !== null,
    })),
  );

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) {
    return <ChatPagePending />;
  }

  return <ChatPageContent initialHasContent={hasContent} />;
}
