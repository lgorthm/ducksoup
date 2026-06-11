import { Outlet } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import { MainLayout } from '@/shared/components/layout';
import { ConversationList } from '@/features/chat/components/conversation-list';
import { useChatStore, MODEL_LABELS } from '@/features/chat/store/chat-store';

export function LayoutWrapper() {
  const { conversations, currentConversationId, selectedModel } = useChatStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      selectedModel: s.selectedModel,
    })),
  );

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );
  const conversationTitle = currentConversation?.title;
  const modelName = MODEL_LABELS[selectedModel];

  return (
    <MainLayout
      sidebarContent={<ConversationList />}
      conversationTitle={conversationTitle}
      modelName={modelName}
    >
      <Outlet />
    </MainLayout>
  );
}
