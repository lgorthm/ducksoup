import { useCallback } from 'react';
import type { ModelName } from '@/stores/models';
import { ChatInput } from '@/features/chat/components/chat-input';
import {
  cancelStream,
  sendMessage,
  toggleDeepThink,
  toggleWebSearch,
} from '@/stores/actions';
import { useStore } from '@/stores';
import { useStreamStatus } from '@/stores/selectors';
import type { PendingImage } from '@/features/chat/utils/image-attachments';

/**
 * ChatInput 的 store 接线容器。
 * draftModel 仅对新会话生效（欢迎页传入）；已有会话时 sendMessage 忽略它。
 */
export function ChatComposer({
  draftModel,
  onPendingImagesChange,
}: {
  draftModel?: ModelName;
  onPendingImagesChange?: (count: number) => void;
}) {
  const { isLoading, isStreaming } = useStreamStatus();
  const deepThink = useStore((s) => s.deepThink);
  const webSearch = useStore((s) => s.webSearch);
  const currentConversationId = useStore((s) => s.currentConversationId);
  const conversations = useStore((s) => s.conversations);
  const conversation = conversations.find(
    (c) => c.id === currentConversationId,
  );
  const model = conversation?.model ?? draftModel;
  const canAttachImages = model !== 'deepseek-v4-pro';

  const handleSend = useCallback(
    (content: string, _deepThink: boolean, images: PendingImage[]) => {
      void sendMessage(content, draftModel, images);
    },
    [draftModel],
  );

  return (
    <ChatInput
      onSend={handleSend}
      disabled={isLoading}
      isStreaming={isStreaming}
      onCancel={cancelStream}
      deepThink={deepThink}
      onToggleDeepThink={toggleDeepThink}
      webSearch={webSearch}
      onToggleWebSearch={toggleWebSearch}
      canAttachImages={canAttachImages}
      onPendingImagesChange={onPendingImagesChange}
    />
  );
}
