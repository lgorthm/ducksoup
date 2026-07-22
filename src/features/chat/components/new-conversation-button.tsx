import { useTranslation } from 'react-i18next';
import { SquarePen } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useChatStore } from '@/features/chat/store/chat-store';

export function NewConversationButton() {
  const { t } = useTranslation();
  const startNewConversation = useChatStore((s) => s.startNewConversation);

  return (
    <Button
      data-testid="toolbar-new-conversation"
      variant="ghost"
      size="icon-sm"
      aria-label={t('conversation.startNew')}
      title={t('conversation.startNew')}
      onClick={startNewConversation}
    >
      <SquarePen />
    </Button>
  );
}
