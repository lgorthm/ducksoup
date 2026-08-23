import { describe, it, expect } from 'vitest';
import type { Conversation } from '@/stores/models';
import {
  groupConversations,
  groupKeyAttr,
  type ConversationGroupKey,
} from './group-conversations';

function localTs(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function makeConv(
  id: string,
  updatedAt: number,
  pinnedAt?: number,
): Conversation {
  return {
    id,
    title: id,
    createdAt: updatedAt,
    updatedAt,
    messageCount: 0,
    rootId: `root-${id}`,
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
    ...(pinnedAt != null ? { pinnedAt } : {}),
  };
}

function groupTypes(now: number, convs: Conversation[]) {
  return groupConversations(convs, now).map((g) => groupKeyAttr(g.key));
}

function idsIn(
  groups: ReturnType<typeof groupConversations>,
  attr: string,
): string[] {
  return (
    groups
      .find((g) => groupKeyAttr(g.key) === attr)
      ?.conversations.map((c) => c.id) ?? []
  );
}

const NOW = localTs(2026, 8, 23, 15, 0);

describe('groupKeyAttr', () => {
  it('固定组返回 type，月份组返回 YYYY-MM', () => {
    expect(groupKeyAttr({ type: 'today' })).toBe('today');
    const month: ConversationGroupKey = {
      type: 'month',
      year: 2026,
      month: 3,
    };
    expect(groupKeyAttr(month)).toBe('2026-03');
  });
});

describe('groupConversations', () => {
  it('空列表返回空分组', () => {
    expect(groupConversations([], NOW)).toEqual([]);
  });

  it('按置顶、今天、昨天、7天内、30天内、年-月互斥分桶', () => {
    const convs = [
      makeConv('pinned-old', localTs(2026, 1, 1), localTs(2026, 8, 20)),
      makeConv('today', localTs(2026, 8, 23, 10)),
      makeConv('yesterday', localTs(2026, 8, 22, 8)),
      makeConv('last7', localTs(2026, 8, 16, 0)),
      makeConv('last30', localTs(2026, 7, 24, 0)),
      makeConv('july', localTs(2026, 7, 23, 23, 59)),
      makeConv('june', localTs(2026, 6, 15)),
    ];

    const groups = groupConversations(convs, NOW);
    expect(groups.map((g) => groupKeyAttr(g.key))).toEqual([
      'pinned',
      'today',
      'yesterday',
      'last7Days',
      'last30Days',
      '2026-07',
      '2026-06',
    ]);
    expect(idsIn(groups, 'pinned')).toEqual(['pinned-old']);
    expect(idsIn(groups, 'today')).toEqual(['today']);
    expect(idsIn(groups, 'yesterday')).toEqual(['yesterday']);
    expect(idsIn(groups, 'last7Days')).toEqual(['last7']);
    expect(idsIn(groups, 'last30Days')).toEqual(['last30']);
    expect(idsIn(groups, '2026-07')).toEqual(['july']);
    expect(idsIn(groups, '2026-06')).toEqual(['june']);
  });

  it('置顶会话不出现在日期组', () => {
    const convs = [
      makeConv('p', localTs(2026, 8, 23, 12), localTs(2026, 8, 23, 13)),
    ];
    const groups = groupConversations(convs, NOW);
    expect(groupTypes(NOW, convs)).toEqual(['pinned']);
    expect(idsIn(groups, 'today')).toEqual([]);
  });

  it('边界：今天 00:00 归今天，昨天 00:00 归昨天', () => {
    const convs = [
      makeConv('today-start', localTs(2026, 8, 23, 0, 0)),
      makeConv('yest-start', localTs(2026, 8, 22, 0, 0)),
      makeConv('yest-end', localTs(2026, 8, 22, 23, 59)),
    ];
    const groups = groupConversations(convs, NOW);
    expect(idsIn(groups, 'today')).toEqual(['today-start']);
    expect(idsIn(groups, 'yesterday')).toEqual(['yest-end', 'yest-start']);
  });

  it('边界：7 天前 00:00 归 7 天内，再早一秒归 30 天内', () => {
    const convs = [
      makeConv('d7', localTs(2026, 8, 16, 0, 0)),
      makeConv('before-d7', localTs(2026, 8, 15, 23, 59)),
    ];
    const groups = groupConversations(convs, NOW);
    expect(idsIn(groups, 'last7Days')).toEqual(['d7']);
    expect(idsIn(groups, 'last30Days')).toEqual(['before-d7']);
  });

  it('边界：30 天前 00:00 归 30 天内，再早一秒归年-月', () => {
    const convs = [
      makeConv('d30', localTs(2026, 7, 24, 0, 0)),
      makeConv('before-d30', localTs(2026, 7, 23, 23, 59)),
    ];
    const groups = groupConversations(convs, NOW);
    expect(idsIn(groups, 'last30Days')).toEqual(['d30']);
    expect(idsIn(groups, '2026-07')).toEqual(['before-d30']);
  });

  it('未来 updatedAt 归入今天', () => {
    const convs = [makeConv('future', localTs(2026, 8, 24, 0, 0))];
    expect(groupTypes(NOW, convs)).toEqual(['today']);
  });

  it('组内按 updatedAt 降序', () => {
    const convs = [
      makeConv('t-old', localTs(2026, 8, 23, 8)),
      makeConv('t-new', localTs(2026, 8, 23, 14)),
      makeConv('t-mid', localTs(2026, 8, 23, 11)),
    ];
    const groups = groupConversations(convs, NOW);
    expect(idsIn(groups, 'today')).toEqual(['t-new', 't-mid', 't-old']);
  });

  it('置顶组内也按 updatedAt 降序', () => {
    const convs = [
      makeConv('p-old', localTs(2026, 8, 20), 1),
      makeConv('p-new', localTs(2026, 8, 23, 10), 2),
    ];
    expect(idsIn(groupConversations(convs, NOW), 'pinned')).toEqual([
      'p-new',
      'p-old',
    ]);
  });

  it('空组省略', () => {
    const convs = [makeConv('only-today', localTs(2026, 8, 23, 10))];
    expect(groupTypes(NOW, convs)).toEqual(['today']);
  });

  it('年-月组按时间倒序，新月份在上', () => {
    const convs = [
      makeConv('jan', localTs(2026, 1, 10)),
      makeConv('dec-prev', localTs(2025, 12, 20)),
      makeConv('jun', localTs(2026, 6, 1)),
    ];
    expect(groupTypes(NOW, convs)).toEqual(['2026-06', '2026-01', '2025-12']);
  });
});
