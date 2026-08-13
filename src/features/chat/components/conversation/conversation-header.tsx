import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';

interface ConversationHeaderProps {
  title?: string;
  loading?: boolean;
  modelName?: string;
}

export function ConversationHeader({
  title,
  loading,
  modelName,
}: ConversationHeaderProps) {
  // 标题加载期间保留最短展示时长；标题未知（欢迎页路径）时保持空白，不闪骨架屏
  const { revealed, wasLoading } = useMinLoadingDisplay(!loading);

  if (title == null) {
    return null;
  }

  if (!revealed) {
    return (
      <div
        data-testid="conversation-title-skeleton"
        className="flex min-w-0 flex-col gap-1"
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        wasLoading && 'animate-in fade-in-0 duration-300',
      )}
    >
      <span className="truncate text-sm font-medium">{title}</span>
      {modelName != null ? (
        <span className="truncate text-xs text-muted-foreground">
          {modelName}
        </span>
      ) : null}
    </div>
  );
}
