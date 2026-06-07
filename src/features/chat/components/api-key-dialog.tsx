import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { useChatStore } from '@/features/chat/store/chat-store';

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const setApiKey = useChatStore((s) => s.setApiKey);
  const hasApiKey = useChatStore((s) => s.hasApiKey);

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setInputValue('');
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !hasApiKey) {
      toast.warning(t('apiKey.closeWarning'));
      return;
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('apiKey.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('apiKey.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="sk-..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <div className="flex justify-end gap-2">
            {hasApiKey && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
            )}
            <Button onClick={handleSave} disabled={!inputValue.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
