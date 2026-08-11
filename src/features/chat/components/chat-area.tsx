import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ChatMessageList } from '@/features/chat/components/chat-message-list';
import type { ChatListController } from '@/features/chat/hooks/use-chat-list-controller';
import { ChatScrollNav } from '@/features/chat/components/chat-scroll-nav';
import type { NavUserMessage } from '@/features/chat/components/chat-scroll-nav';
import { ChatInput } from '@/features/chat/components/chat-input';
import { ChatWelcome } from '@/features/chat/components/chat-welcome';
import { cancelStream, sendMessage, toggleDeepThink } from '@/stores/actions';
import { useChatAreaState } from '@/stores/selectors';

export function ChatArea() {
  const { t } = useTranslation();
  const { messages, streamingMessage, isLoading, error, deepThink } =
    useChatAreaState();

  const handleSend = useCallback((content: string, deepThinkFlag: boolean) => {
    void sendMessage(content, deepThinkFlag);
  }, []);

  // 虚拟列表控制器 ref，由 ChatMessageList 填充
  const controllerRef = useRef<ChatListController | null>(null);

  // 从消息列表中提取用户消息（用于导航栏横杠）
  const userMessages = useMemo<NavUserMessage[]>(
    () =>
      messages.reduce<NavUserMessage[]>((acc, msg, index) => {
        if (msg.role === 'user') {
          acc.push({ index, content: msg.content });
        }
        return acc;
      }, []),
    [messages],
  );

  if (messages.length === 0 && !streamingMessage) {
    return <ChatWelcome />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatMessageList
        messages={messages}
        streamingMessage={streamingMessage}
        controllerRef={controllerRef}
      >
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
            className="wrap-break-word rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
      </ChatMessageList>

      {userMessages.length > 1 && (
        <ChatScrollNav
          userMessages={userMessages}
          controllerRef={controllerRef}
        />
      )}

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
