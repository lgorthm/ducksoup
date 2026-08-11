import type { BranchInfo, StoredMessage } from '@/features/chat/types/deepseek';

export function deriveActivePath(
  allMessages: StoredMessage[],
  activeLeafId: string | null | undefined,
): StoredMessage[] {
  if (allMessages.length === 0) return [];
  let leafId = activeLeafId ?? null;
  if (!leafId) {
    const sorted = [...allMessages].sort((a, b) => a.createdAt - b.createdAt);
    leafId = sorted[sorted.length - 1].id;
  }
  const byId = new Map(allMessages.map((m) => [m.id, m]));
  const path: StoredMessage[] = [];
  const seen = new Set<string>();
  let cur = byId.get(leafId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path.reverse();
}

export function deriveBranchInfo(
  allMessages: StoredMessage[],
  message: StoredMessage,
): BranchInfo {
  const siblings = allMessages
    .filter(
      (m) =>
        m.conversationId === message.conversationId &&
        (m.parentId ?? null) === (message.parentId ?? null),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const idx = siblings.findIndex((m) => m.id === message.id);
  return {
    current: idx + 1,
    total: siblings.length,
    prevSiblingId: idx > 0 ? siblings[idx - 1].id : null,
    nextSiblingId:
      idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].id : null,
  };
}
