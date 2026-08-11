import { useTranslation } from 'react-i18next';
import { SquarePen } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { startNewConversation } from '@/stores/actions';

export function NewConversationButton() {
  const { t } = useTranslation();

  return (
    <Button
      data-testid="toolbar-new-conversation"
      variant="ghost"
      size="icon-sm"
      aria-label={t('conversation.startNew')}
      title={t('conversation.startNew')}
      onClick={startNewConversation}
      className="rounded-full hover:bg-foreground/15 dark:hover:bg-foreground/15"
    >
      <SquarePen />
    </Button>
  );
}
