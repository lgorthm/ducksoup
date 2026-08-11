import { Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout/main-layout';
import { ConversationList } from '@/features/chat/components/conversation-list';
import { NewConversationButton } from '@/features/chat/components/new-conversation-button';
import { MODEL_LABELS } from '@/stores/models';
import { useChatLayoutState } from '@/stores/selectors';

export function ChatLayout() {
  const { conversations, currentConversationId, selectedModel, initialized } =
    useChatLayoutState();

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );
  const conversationTitle = currentConversation?.title;
  const modelName = MODEL_LABELS[selectedModel];

  return (
    <MainLayout
      sidebarContent={<ConversationList />}
      buttonGroup={<NewConversationButton />}
      conversationTitle={conversationTitle}
      titleLoading={!initialized}
      modelName={modelName}
    >
      <Outlet />
    </MainLayout>
  );
}
