import { Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout';
import { ConversationList } from '@/features/chat/components/conversation-list';
import { useChatStore, MODEL_LABELS } from '@/features/chat/store/chat-store';

export function LayoutWrapper() {
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentConversationId);
  const selectedModel = useChatStore((s) => s.selectedModel);

  const currentConversation = conversations.find((c) => c.id === currentId);
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
