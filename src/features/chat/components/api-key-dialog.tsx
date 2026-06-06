import { useState } from 'react';
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

  // 已经有 key 时不强制显示（可通过设置按钮打开）
  const handleOpenChange = (open: boolean) => {
    if (!open && !hasApiKey) return; // 防止没有 key 时关闭
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置 API Key</DialogTitle>
          <DialogDescription>
            请输入您的 DeepSeek API Key。Key 将存储在本地浏览器中，不会上传到任何服务器。
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
