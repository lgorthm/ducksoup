import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import {
  groupKeyAttr,
  type ConversationGroupKey,
} from '@/features/chat/utils/group-conversations';

const FIXED_LABEL_KEYS = {
  pinned: 'conversation.group.pinned',
  today: 'conversation.group.today',
  yesterday: 'conversation.group.yesterday',
  last7Days: 'conversation.group.last7Days',
  last30Days: 'conversation.group.last30Days',
} as const;

function formatGroupLabel(
  key: ConversationGroupKey,
  t: (k: string) => string,
  locale: string,
): string {
  if (key.type === 'month') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
    }).format(new Date(key.year, key.month - 1, 1));
  }
  return t(FIXED_LABEL_KEYS[key.type]);
}

interface ConversationGroupHeaderProps {
  groupKey: ConversationGroupKey;
  isFirst: boolean;
}

export function ConversationGroupHeader({
  groupKey,
  isFirst,
}: ConversationGroupHeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <div
      data-testid="conversation-group"
      data-group={groupKeyAttr(groupKey)}
      className={cn(
        'sticky top-0 z-[1] bg-sidebar px-2 pb-1 text-xs font-medium text-muted-foreground',
        isFirst ? 'pt-1' : 'pt-3',
      )}
    >
      {formatGroupLabel(groupKey, t, i18n.language)}
    </div>
  );
}
