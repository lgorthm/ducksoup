import { useState, useCallback } from 'react';
import { Sun, Moon, Monitor, Check, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/shared/components/theme-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useChatStore } from '@/features/chat/store/chat-store';

type Theme = 'dark' | 'light' | 'system';

type SettingsTab = 'general' | 'api-key';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile?: boolean;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

function GeneralSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">选择界面主题</p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-none border p-3 text-xs transition-colors',
                'min-h-18 justify-center active:translate-y-px',
                isActive
                  ? 'border-foreground bg-foreground/5'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <option.icon className="size-4" />
              <span>{option.label}</span>
              {isActive && <Check className="size-3 text-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ApiKeySettings() {
  const apiKeyFromStore = useChatStore((s) => s.apiKey);
  const setApiKeyInStore = useChatStore((s) => s.setApiKey);
  const [apiKey, setApiKey] = useState(apiKeyFromStore);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = useCallback(() => {
    if (apiKey.trim()) {
      setApiKeyInStore(apiKey.trim());
    } else {
      setApiKeyInStore('');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKey, setApiKeyInStore]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Key 将存储在本地浏览器中，不会上传到任何服务器。
      </p>
      <div className="relative">
        <Input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setSaved(false);
          }}
          placeholder="请输入您的 DeepSeek API Key"
          className="w-full pr-8"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute top-1/2 right-2 min-h-6 min-w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showKey ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </button>
      </div>
      <Button onClick={handleSave} size="sm" className="w-full sm:w-auto">
        {saved ? '已保存' : '保存'}
      </Button>
    </div>
  );
}

function TabButtons({
  active,
  onChange,
}: {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  return (
    <div className="flex border-b">
      {[
        { key: 'general' as const, label: '通用设置' },
        { key: 'api-key' as const, label: 'API KEY 设置' },
      ].map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'min-h-11 flex-1 px-3 py-2.5 text-xs font-medium transition-colors',
            active === tab.key
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SettingsContent({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  return (
    <div>
      <TabButtons active={activeTab} onChange={onTabChange} />
      <div className="min-h-38 p-4">
        {activeTab === 'general' ? <GeneralSettings /> : <ApiKeySettings />}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  isMobile = false,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="z-10001 h-auto max-h-[80vh] rounded-t-lg"
          overlayClassName="z-[10001]"
        >
          <SheetHeader>
            <SheetTitle>系统设置</SheetTitle>
          </SheetHeader>
          <SettingsContent activeTab={activeTab} onTabChange={setActiveTab} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-10001 sm:max-w-md"
        overlayClassName="z-[10001]"
      >
        <DialogHeader>
          <DialogTitle>系统设置</DialogTitle>
        </DialogHeader>
        <SettingsContent activeTab={activeTab} onTabChange={setActiveTab} />
      </DialogContent>
    </Dialog>
  );
}
