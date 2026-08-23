import type { Conversation } from '@/stores/models';

export type ConversationGroupKey =
  | { type: 'pinned' }
  | { type: 'today' }
  | { type: 'yesterday' }
  | { type: 'last7Days' }
  | { type: 'last30Days' }
  | { type: 'month'; year: number; month: number };

export interface ConversationGroup {
  key: ConversationGroupKey;
  conversations: Conversation[];
}

const FIXED_ORDER = [
  'pinned',
  'today',
  'yesterday',
  'last7Days',
  'last30Days',
] as const;

export function groupKeyAttr(key: ConversationGroupKey): string {
  if (key.type === 'month') {
    return `${key.year}-${String(key.month).padStart(2, '0')}`;
  }
  return key.type;
}

function daysAgoStart(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

function byUpdatedAtDesc(a: Conversation, b: Conversation): number {
  return b.updatedAt - a.updatedAt;
}

function dateBucket(
  updatedAt: number,
  today: number,
  yesterday: number,
  d7: number,
  d30: number,
): ConversationGroupKey {
  if (updatedAt >= today) return { type: 'today' };
  if (updatedAt >= yesterday) return { type: 'yesterday' };
  if (updatedAt >= d7) return { type: 'last7Days' };
  if (updatedAt >= d30) return { type: 'last30Days' };
  const d = new Date(updatedAt);
  return {
    type: 'month',
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

export function groupConversations(
  conversations: Conversation[],
  now: number,
): ConversationGroup[] {
  const today = daysAgoStart(now, 0);
  const yesterday = daysAgoStart(now, 1);
  const d7 = daysAgoStart(now, 7);
  const d30 = daysAgoStart(now, 30);

  const buckets = new Map<
    string,
    { key: ConversationGroupKey; conversations: Conversation[] }
  >();

  for (const conv of conversations) {
    const key: ConversationGroupKey =
      conv.pinnedAt != null
        ? { type: 'pinned' }
        : dateBucket(conv.updatedAt, today, yesterday, d7, d30);
    const id = groupKeyAttr(key);
    const bucket = buckets.get(id);
    if (bucket) {
      bucket.conversations.push(conv);
    } else {
      buckets.set(id, { key, conversations: [conv] });
    }
  }

  const groups: ConversationGroup[] = [];

  for (const type of FIXED_ORDER) {
    const bucket = buckets.get(type);
    if (!bucket) continue;
    bucket.conversations.sort(byUpdatedAtDesc);
    groups.push(bucket);
    buckets.delete(type);
  }

  const monthGroups = [...buckets.values()];
  for (const group of monthGroups) {
    group.conversations.sort(byUpdatedAtDesc);
  }
  monthGroups.sort((a, b) => {
    if (a.key.type !== 'month' || b.key.type !== 'month') return 0;
    if (a.key.year !== b.key.year) return b.key.year - a.key.year;
    return b.key.month - a.key.month;
  });

  return groups.concat(monthGroups);
}
