import { useCallback } from 'react';
import { ChatInput } from '@/features/chat/components/chat-input';
import { cancelStream, sendMessage, toggleDeepThink } from '@/stores/actions';
import { useStore } from '@/stores';
import { useStreamStatus } from '@/stores/selectors';

/**
 * ChatInput 的 store 接线容器：订阅流式状态与 deepThink，
 * 让 ChatArea / ChatWelcome 不必各自重复接线，ChatInput 保持纯受控。
 */
export function ChatComposer() {
  const { isLoading, isStreaming } = useStreamStatus();
  const deepThink = useStore((s) => s.deepThink);

  const handleSend = useCallback((content: string, deepThinkFlag: boolean) => {
    void sendMessage(content, deepThinkFlag);
  }, []);

  return (
    <ChatInput
      onSend={handleSend}
      disabled={isLoading}
      isStreaming={isStreaming}
      onCancel={cancelStream}
      deepThink={deepThink}
      onToggleDeepThink={toggleDeepThink}
    />
  );
}
