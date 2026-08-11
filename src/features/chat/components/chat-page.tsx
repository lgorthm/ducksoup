import { useEffect, useState } from 'react';
import { ApiKeyDialog } from '@/features/chat/components/api-key-dialog';
import { ChatArea } from '@/features/chat/components/chat-area';
import {
  ChatPagePending,
  ChatPageSkeleton,
} from '@/features/chat/components/chat-page-skeleton';
import { init } from '@/stores/actions';
import { useStore } from '@/stores';
import { useHasContent, useInitialized } from '@/stores/selectors';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';

interface ChatPageContentProps {
  initialHasContent: boolean;
}

function ChatPageContent({ initialHasContent }: ChatPageContentProps) {
  const hasApiKey = useStore((s) => s.hasApiKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  // 挂载后置 true，驱动 useMinLoadingDisplay 从挂载时刻计时：
  // 历史内容首次加载时保留最短骨架屏时长；欢迎页路径立即 revealed
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { revealed } = useMinLoadingDisplay(!initialHasContent || mounted);

  // 首次加载完成后，如果没有 API Key 则弹出设置框
  const needShowKeyDialog = revealed && !hasApiKey;
  const dialogIsOpen = needShowKeyDialog || dialogOpen;

  if (initialHasContent && !revealed) {
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
  const initialized = useInitialized();
  const hasContent = useHasContent();

  useEffect(() => {
    void init();
  }, []);

  if (!initialized) {
    return <ChatPagePending />;
  }

  return <ChatPageContent initialHasContent={hasContent} />;
}
