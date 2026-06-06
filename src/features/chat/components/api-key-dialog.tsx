import { useState } from 'react';
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
      toast.warning('请先设置 API Key 后再关闭此窗口');
      return;
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>设置 API Key</DialogTitle>
          <DialogDescription>
            请输入您的 DeepSeek API Key。Key
            将存储在本地浏览器中，不会上传到任何服务器。
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
                取消
              </Button>
            )}
            <Button onClick={handleSave} disabled={!inputValue.trim()}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
