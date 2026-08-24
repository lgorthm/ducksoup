import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/components/ui/skeleton';

// 模拟真实聊天界面结构的骨架屏：消息列表 max-w-[744px]、输入区 max-w-[776px]
export function ChatPageSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex h-full flex-col overflow-hidden"
      data-testid="chat-page-skeleton"
    >
      <span className="sr-only">{t('chat.page.loading')}</span>
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-[744px] flex-1 flex-col gap-6 overflow-hidden px-4 py-6"
      >
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/5 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/3 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <div aria-hidden className="mx-auto w-full max-w-[776px] px-4">
        <Skeleton className="h-24 w-full rounded-[1.5rem]" />
        <Skeleton className="mx-auto my-2 h-3 w-56" />
      </div>
    </div>
  );
}

export function ChatPagePending() {
  const { t } = useTranslation();

  return (
    <div role="status" className="h-full" data-testid="chat-page-pending">
      <span className="sr-only">{t('chat.page.loading')}</span>
    </div>
  );
}
