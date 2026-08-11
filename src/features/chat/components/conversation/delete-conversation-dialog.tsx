import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

interface DeleteConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConversationDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteConversationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('conversation.delete')}</DialogTitle>
          <DialogDescription>
            {t('conversation.deleteConfirmDesc')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            data-testid="confirm-delete-conversation"
            onClick={onConfirm}
          >
            {t('conversation.deleteConfirmBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
