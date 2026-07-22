import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Eye,
  EyeOff,
  Languages,
  RefreshCw,
  AlertCircle,
  CircleCheck,
  CircleX,
} from 'lucide-react';
import { useTheme } from '@/shared/providers/theme-provider';
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
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useChatStore } from '@/features/chat/store/chat-store';
import {
  fetchBalance,
  BalanceError,
  loadBalanceCache,
  saveBalanceCache,
} from '@/features/chat/utils/balance';
import type {
  BalanceResponse,
  BalanceInfo,
} from '@/features/chat/types/deepseek';

type SettingsTab = 'general' | 'api-key' | 'balance';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile?: boolean;
}

function GeneralSettings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light' as const, label: t('settings.themeLight'), icon: Sun },
    { value: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
    {
      value: 'system' as const,
      label: t('settings.themeSystem'),
      icon: Monitor,
    },
  ];

  const languageOptions = [
    { value: 'zh-CN' as const, label: t('settings.languageZhCN') },
    { value: 'en' as const, label: t('settings.languageEn') },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('settings.themeDescription')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => {
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors',
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

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('settings.languageDescription')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {languageOptions.map((option) => {
            const isActive = i18n.language === option.value;
            return (
              <button
                key={option.value}
                onClick={() => i18n.changeLanguage(option.value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 text-xs transition-colors',
                  'min-h-11 justify-center active:translate-y-px',
                  isActive
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <Languages className="size-4" />
                <span>{option.label}</span>
                {isActive && <Check className="size-3 text-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApiKeySettings() {
  const { t } = useTranslation();
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
        {t('apiKey.storageNotice')}
      </p>
      <div className="relative">
        <Input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setSaved(false);
          }}
          placeholder={t('apiKey.placeholder')}
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
        {saved ? t('common.saved') : t('common.save')}
      </Button>
    </div>
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
};

function formatBalance(amount: string, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  return `${symbol}${amount}`;
}

function BalanceCard({ info }: { info: BalanceInfo }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          {info.currency === 'CNY'
            ? t('balance.currency') + ': CNY'
            : t('balance.currency') + ': USD'}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('balance.totalBalance')}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatBalance(info.total_balance, info.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('balance.grantedBalance')}
          </span>
          <span className="text-xs tabular-nums">
            {formatBalance(info.granted_balance, info.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('balance.toppedUpBalance')}
          </span>
          <span className="text-xs tabular-nums">
            {formatBalance(info.topped_up_balance, info.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="space-y-3 border border-border p-3">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

function BalanceSettings() {
  const { t } = useTranslation();
  const apiKey = useChatStore((s) => s.apiKey);

  // 挂载时从 sessionStorage 恢复缓存
  const cached = useMemo(() => loadBalanceCache(apiKey), [apiKey]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceResponse | null>(
    cached?.balance ?? null,
  );
  const [lastUpdated, setLastUpdated] = useState<number | null>(
    cached?.lastUpdated ?? null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const handleQuery = useCallback(async () => {
    if (!apiKey) return;
    // 取消上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchBalance(apiKey, controller.signal);
      setBalance(result);
      setLastUpdated(Date.now());
      // 写入 sessionStorage 缓存
      saveBalanceCache(apiKey, result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message =
        err instanceof BalanceError || err instanceof Error
          ? err.message
          : 'Unknown error';
      setError(message);
      setBalance(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }, [apiKey]);

  // 未配置 API Key
  if (!apiKey) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('balance.description')}
        </p>
        <div className="flex items-center gap-2 border border-border p-3 text-xs text-muted-foreground">
          <AlertCircle className="size-4 shrink-0" />
          <span>{t('balance.noApiKey')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t('balance.description')}
      </p>

      <Button
        onClick={handleQuery}
        disabled={loading}
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        data-testid="balance-query-btn"
      >
        <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        {loading
          ? t('balance.loading')
          : balance
            ? t('balance.retry')
            : t('balance.query')}
      </Button>

      {/* 加载中骨架屏 */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <BalanceSkeleton />
        </div>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <div className="flex flex-col gap-2 border border-destructive/30 p-3">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="font-medium">{t('balance.queryFailed')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {/* 成功结果 */}
      {!loading && !error && balance && (
        <div className="space-y-3">
          {/* 账户状态 */}
          <div className="flex items-center gap-2 rounded-lg border border-border p-3">
            {balance.is_available ? (
              <CircleCheck className="size-4 shrink-0 text-green-600" />
            ) : (
              <CircleX className="size-4 shrink-0 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground">
              {t('balance.status')}:
            </span>
            <span
              className={cn(
                'text-xs font-medium',
                balance.is_available ? 'text-green-600' : 'text-destructive',
              )}
            >
              {balance.is_available
                ? t('balance.available')
                : t('balance.unavailable')}
            </span>
          </div>

          {/* 余额卡片 */}
          {balance.balance_infos.length > 0 ? (
            <div className="space-y-2">
              {balance.balance_infos.map((info, i) => (
                <BalanceCard key={`${info.currency}-${i}`} info={info} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('balance.unavailable')}
            </p>
          )}

          {/* 最后更新时间 */}
          {lastUpdated && (
            <p className="text-right text-xs text-muted-foreground">
              {t('balance.lastUpdated')}:{' '}
              {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
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
  const { t } = useTranslation();
  return (
    <div className="flex border-b">
      {[
        { key: 'general' as const, label: t('settings.tabGeneral') },
        { key: 'api-key' as const, label: t('settings.tabApiKey') },
        { key: 'balance' as const, label: t('settings.tabBalance') },
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
      <div className="min-h-140 p-4">
        {activeTab === 'general' ? (
          <GeneralSettings />
        ) : activeTab === 'api-key' ? (
          <ApiKeySettings />
        ) : (
          <BalanceSettings />
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  isMobile = false,
}: SettingsDialogProps) {
  const { t } = useTranslation();
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
            <SheetTitle>{t('settings.title')}</SheetTitle>
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
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>
        <SettingsContent activeTab={activeTab} onTabChange={setActiveTab} />
      </DialogContent>
    </Dialog>
  );
}
