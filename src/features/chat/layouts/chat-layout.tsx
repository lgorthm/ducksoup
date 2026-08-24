import { Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout/main-layout';
import { ConversationHeader } from '@/features/chat/components/conversation/conversation-header';
import { ConversationList } from '@/features/chat/components/conversation/conversation-list';
import { NewConversationButton } from '@/features/chat/components/conversation/new-conversation-button';
import { SettingsEntry } from '@/features/settings/settings-entry';
import { MODEL_LABELS } from '@/stores/models';
import { useChatLayoutState } from '@/stores/selectors';

export function ChatLayout() {
  const { initialized, title, model } = useChatLayoutState();

  return (
    <MainLayout
      header={
        <ConversationHeader
          title={title}
          loading={!initialized}
          modelName={model != null ? MODEL_LABELS[model] : undefined}
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
