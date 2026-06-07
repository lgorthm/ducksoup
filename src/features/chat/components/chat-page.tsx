import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiKeyDialog } from '@/features/chat/components/api-key-dialog';
import { ChatArea } from '@/features/chat/components/chat-area';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ChatPage() {
  const { t } = useTranslation();
  const init = useChatStore((s) => s.init);
  const hasApiKey = useChatStore((s) => s.hasApiKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    init().then(() => setReady(true));
  }, [init]);

  // 首次加载完成后，如果没有 API Key 则弹出设置框
  const needShowKeyDialog = ready && !hasApiKey;
  const dialogIsOpen = needShowKeyDialog || dialogOpen;

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('chat.page.loading')}</p>
      </div>
    );
  }

  return (
    <>
      <ChatArea />
      <ApiKeyDialog open={dialogIsOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
