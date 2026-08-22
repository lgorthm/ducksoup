import { Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout/main-layout';
import { ConversationHeader } from '@/features/chat/components/conversation/conversation-header';
import { ConversationList } from '@/features/chat/components/conversation/conversation-list';
import { NewConversationButton } from '@/features/chat/components/conversation/new-conversation-button';
import { SettingsEntry } from '@/features/settings/settings-entry';
import { MODEL_LABELS } from '@/stores/models';
import { useChatLayoutState } from '@/stores/selectors';

export function ChatLayout() {
  const { conversations, currentConversationId, initialized } =
    useChatLayoutState();

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );

  return (
    <MainLayout
      header={
        <ConversationHeader
          title={currentConversation?.title}
          loading={!initialized}
          modelName={
            currentConversation
              ? MODEL_LABELS[currentConversation.model]
              : undefined
          }
        />
      }
      sidebarContent={<ConversationList />}
      sidebarFooter={<SettingsEntry />}
      toolbarActions={<NewConversationButton />}
    >
      <Outlet />
    </MainLayout>
  );
}
