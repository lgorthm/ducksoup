import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ChatMessageList } from '@/features/chat/components/chat-message-list';
import { ChatInput } from '@/features/chat/components/chat-input';
import { ChatWelcome } from '@/features/chat/components/chat-welcome';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ChatArea() {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);

  if (messages.length === 0) {
    return <ChatWelcome />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatMessageList messages={messages}>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('chat.area.thinking')}
          </div>
        )}
        {error && (
          <div className="rounded-none bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </ChatMessageList>

      <div className="mx-auto w-full max-w-[776px] px-4">
        <ChatInput
          onSend={(content) => sendMessage(content)}
          disabled={isLoading}
        />
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
