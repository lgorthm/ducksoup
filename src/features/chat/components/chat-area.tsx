import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Loader2 } from 'lucide-react';
import { ChatMessageList } from '@/features/chat/components/chat-message-list';
import { ChatInput } from '@/features/chat/components/chat-input';
import { ChatWelcome } from '@/features/chat/components/chat-welcome';
import { useChatStore } from '@/features/chat/store/chat-store';

export function ChatArea() {
  const { t } = useTranslation();
  const {
    messages,
    streamingMessage,
    isLoading,
    error,
    sendMessage,
    cancelStream,
    deepThink,
    toggleDeepThink,
  } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      streamingMessage: s.streamingMessage,
      isLoading: s.isLoading,
      error: s.error,
      sendMessage: s.sendMessage,
      cancelStream: s.cancelStream,
      deepThink: s.deepThink,
      toggleDeepThink: s.toggleDeepThink,
    })),
  );

  const handleSend = useCallback(
    (content: string, dt: boolean) => {
      sendMessage(content, dt);
    },
    [sendMessage],
  );

  if (messages.length === 0 && !streamingMessage) {
    return <ChatWelcome />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatMessageList messages={messages} streamingMessage={streamingMessage}>
        {isLoading && !streamingMessage && (
          <div
            data-testid="loading-indicator"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {t('chat.area.thinking')}
          </div>
        )}
        {error && (
          <div
            data-testid="error-message"
            className="rounded-none bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
      </ChatMessageList>

      <div className="mx-auto w-full max-w-[776px] px-4">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          isStreaming={!!streamingMessage}
          onCancel={cancelStream}
          deepThink={deepThink}
          onToggleDeepThink={toggleDeepThink}
        />
        <p
          data-testid="chat-disclaimer"
          className="py-2 text-center text-xs text-muted-foreground"
        >
          {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
}
