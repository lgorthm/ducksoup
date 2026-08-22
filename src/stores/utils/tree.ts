import type {
  BranchInfo,
  MessageId,
  MessageNode,
  MessageRole,
} from '@/stores/models';

export type { BranchInfo, MessageId, MessageNode };

export interface AppendChildInput {
  id: MessageId;
  conversationId: string;
  role: MessageRole;
  content: string;
  reasoningContent?: string;
  status?: MessageNode['status'];
  createdAt: number;
}

export function createRoot(
  conversationId: string,
  id: MessageId,
  createdAt = 0,
): MessageNode {
  return {
    id,
    conversationId,
    role: 'system',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '',
    status: 'done',
    createdAt,
  };
}

export function hydrateTree(rows: MessageNode[]): Map<MessageId, MessageNode> {
  const map = new Map<MessageId, MessageNode>();
  for (const row of rows) {
    map.set(row.id, {
      ...row,
      parentId: row.parentId ?? null,
      activeChildId: row.activeChildId ?? null,
      siblingIndex: row.siblingIndex ?? 0,
      childrenIds: [],
      deleted: row.deleted,
    });
  }
  for (const node of map.values()) {
    if (node.parentId == null) continue;
    const parent = map.get(node.parentId);
    if (!parent) continue;
    const idx = node.siblingIndex;
    while (parent.childrenIds.length <= idx) {
      parent.childrenIds.push('');
    }
    parent.childrenIds[idx] = node.id;
  }
  return map;
}

export function appendChild(
  map: Map<MessageId, MessageNode>,
  parentId: MessageId,
  input: AppendChildInput,
): MessageNode {
  const parent = map.get(parentId);
  if (!parent) {
    throw new Error(`parent not found: ${parentId}`);
  }
  const siblingIndex = parent.childrenIds.length;
  const node: MessageNode = {
    id: input.id,
    conversationId: input.conversationId,
    role: input.role,
    parentId,
    childrenIds: [],
    siblingIndex,
    activeChildId: null,
    content: input.content,
    reasoningContent: input.reasoningContent,
    status: input.status ?? 'done',
    createdAt: input.createdAt,
  };
  parent.childrenIds.push(node.id);
  parent.activeChildId = node.id;
  map.set(node.id, node);
  return node;
}

function firstLiveChildId(
  map: Map<MessageId, MessageNode>,
  parent: MessageNode,
): MessageId | null {
  if (parent.activeChildId) {
    const preferred = map.get(parent.activeChildId);
    if (preferred && !preferred.deleted) return preferred.id;
  }
  for (const id of parent.childrenIds) {
    if (!id) continue;
    const child = map.get(id);
    if (child && !child.deleted) return child.id;
  }
  return null;
}

export function rebuildActivePath(
  map: Map<MessageId, MessageNode>,
  rootId: MessageId,
): MessageId[] {
  const path: MessageId[] = [];
  const seen = new Set<MessageId>();
  const root = map.get(rootId);
  if (!root) return path;

  let id = firstLiveChildId(map, root);
  while (id && !seen.has(id)) {
    const node = map.get(id);
    if (!node || node.deleted) break;
    seen.add(id);
    path.push(id);
    id = firstLiveChildId(map, node);
  }
  return path;
}

export function switchActiveChild(
  map: Map<MessageId, MessageNode>,
  parentId: MessageId,
  childId: MessageId,
): MessageId | null {
  const parent = map.get(parentId);
  if (!parent) return null;
  parent.activeChildId = childId;

  let leaf = childId;
  const seen = new Set<MessageId>();
  let cur = map.get(childId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    leaf = cur.id;
    const nextId = firstLiveChildId(map, cur);
    if (!nextId || nextId === cur.id) break;
    const next = map.get(nextId);
    if (!next || next.deleted) break;
    cur = next;
  }
  return leaf;
}

export function softDelete(
  map: Map<MessageId, MessageNode>,
  id: MessageId,
): void {
  const node = map.get(id);
  if (!node) return;
  node.deleted = true;
  if (!node.parentId) return;
  const parent = map.get(node.parentId);
  if (!parent || parent.activeChildId !== id) return;
  parent.activeChildId = firstLiveChildId(map, parent);
}

export function liveSiblings(
  map: Map<MessageId, MessageNode>,
  parentId: MessageId,
): MessageNode[] {
  const parent = map.get(parentId);
  if (!parent) return [];
  const result: MessageNode[] = [];
  for (const id of parent.childrenIds) {
    if (!id) continue;
    const child = map.get(id);
    if (child && !child.deleted) result.push(child);
  }
  return result;
}

export function deriveBranchInfo(
  map: Map<MessageId, MessageNode>,
  messageId: MessageId,
): BranchInfo {
  const fallback: BranchInfo = {
    current: 1,
    total: 1,
    prevSiblingId: null,
    nextSiblingId: null,
  };
  const node = map.get(messageId);
  if (!node?.parentId) return fallback;
  const siblings = liveSiblings(map, node.parentId);
  const idx = siblings.findIndex((s) => s.id === messageId);
  if (idx < 0) return fallback;
  return {
    current: idx + 1,
    total: siblings.length,
    prevSiblingId: idx > 0 ? siblings[idx - 1].id : null,
    nextSiblingId: idx < siblings.length - 1 ? siblings[idx + 1].id : null,
  };
}

export function pathNodes(
  map: Map<MessageId, MessageNode>,
  activePath: MessageId[],
): MessageNode[] {
  const nodes: MessageNode[] = [];
  for (const id of activePath) {
    const node = map.get(id);
    if (node) nodes.push(node);
  }
  return nodes;
}

export function countVisibleMessages(
  map: Map<MessageId, MessageNode>,
  rootId: MessageId,
): number {
  let n = 0;
  for (const node of map.values()) {
    if (node.id === rootId || node.deleted) continue;
    if (node.role === 'user' || node.role === 'assistant') n++;
  }
  return n;
}

export function hydrateConversation(
  rows: MessageNode[],
  rootId: MessageId,
): {
  map: Map<MessageId, MessageNode>;
  activePath: MessageId[];
  activeLeafId: MessageId | null;
} {
  const map = hydrateTree(rows);
  const activePath = rebuildActivePath(map, rootId);
  const activeLeafId = activePath[activePath.length - 1] ?? null;
  return { map, activePath, activeLeafId };
}

export function resetRoot(
  map: Map<MessageId, MessageNode>,
  rootId: MessageId,
): void {
  for (const id of [...map.keys()]) {
    if (id !== rootId) map.delete(id);
  }
  const root = map.get(rootId);
  if (root) {
    root.childrenIds = [];
    root.activeChildId = null;
  }
}
