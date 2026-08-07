import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ApiKeyDialog } from '@/features/chat/components/api-key-dialog';
import { ChatArea } from '@/features/chat/components/chat-area';
import { useChatStore } from '@/features/chat/store/chat-store';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';

export function ChatPage() {
  const { t } = useTranslation();
  const { init, hasApiKey } = useChatStore(
    useShallow((s) => ({ init: s.init, hasApiKey: s.hasApiKey })),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initDone, setInitDone] = useState(false);
  // 加载完成时若不足最短展示时长，等剩余时间再切换，避免加载态闪烁
  const { revealed } = useMinLoadingDisplay(initDone);

  useEffect(() => {
    init().then(() => setInitDone(true));
  }, [init]);

  // 首次加载完成后，如果没有 API Key 则弹出设置框
  const needShowKeyDialog = revealed && !hasApiKey;
  const dialogIsOpen = needShowKeyDialog || dialogOpen;

  if (!revealed) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t('chat.page.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full animate-in fade-in-0 duration-300">
      <ChatArea />
      <ApiKeyDialog open={dialogIsOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
