import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useStreamStatus } from '@/stores/selectors';

/**
 * 消息列表底部的会话状态指示：加载中（等待首个 token）与错误提示。
 * 渲染在消息列表滚动容器内的 footer 位置（由 ChatMessageList 的 children 承载）。
 */
export function ChatStatus() {
  const { t } = useTranslation();
  const { isLoading, isStreaming, error } = useStreamStatus();

  return (
    <>
      {isLoading && !isStreaming && (
        <div
          data-testid="loading-indicator"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          {t('chat.area.thinking')}
        </div>
      )}
      {error && (
        <div
          data-testid="error-message"
          className="wrap-break-word rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}
    </>
  );
}
