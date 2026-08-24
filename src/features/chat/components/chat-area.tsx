import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessageList } from '@/features/chat/components/message/chat-message-list';
import type { ChatListController } from '@/features/chat/hooks/use-chat-list-controller';
import { ChatScrollNav } from '@/features/chat/components/message/chat-scroll-nav';
import { ChatScrollToBottom } from '@/features/chat/components/message/chat-scroll-to-bottom';
import { ChatStatus } from '@/features/chat/components/message/chat-status';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { ChatWelcome } from '@/features/chat/components/chat-welcome';
import { useHasContent } from '@/stores/selectors';

/**
 * 聊天主区：布局编排。数据订阅全部下沉到各子组件
 * （列表/导航/状态/输入各自就近订阅 store），
 * 流式 token 更新只重渲染消息列表子树。
 */
export function ChatArea() {
  const { t } = useTranslation();
  const hasContent = useHasContent();
  // 虚拟列表控制器 ref，由 ChatMessageList 填充、滚动导航 / 回到底部消费
  const controllerRef = useRef<ChatListController | null>(null);

  if (!hasContent) {
    return <ChatWelcome />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatMessageList controllerRef={controllerRef}>
        <ChatStatus />
      </ChatMessageList>

      <ChatScrollNav controllerRef={controllerRef} />

      <div className="mx-auto w-full max-w-[776px] px-4">
        <div className="relative">
          <ChatScrollToBottom controllerRef={controllerRef} />
          <ChatComposer />
        </div>
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
