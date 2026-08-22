import type { ChatMessage } from '@/features/chat/types/deepseek';
import type { MessageId, MessageNode } from '@/stores/models';
import { pathNodes } from '@/stores/utils/tree';

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

/** 失败/空取消的 assistant 会留在树上，但不能发给模型。 */
function isSendablePathNode(node: MessageNode): boolean {
  if (node.deleted) return false;
  if (node.role !== 'user' && node.role !== 'assistant') return false;
  if (node.status === 'pending') return false;
  if (node.role === 'assistant' && !node.content) return false;
  return true;
}

export function buildApiMessages(
  map: Map<MessageId, MessageNode>,
  activePath: MessageId[],
): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...pathNodes(map, activePath)
      .filter(isSendablePathNode)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
  ];
}
