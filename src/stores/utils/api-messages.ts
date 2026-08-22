import type { ChatMessage } from '@/features/chat/types/deepseek';
import type { MessageId, MessageNode } from '@/stores/models';
import { pathNodes } from '@/stores/utils/tree';

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

export function buildApiMessages(
  map: Map<MessageId, MessageNode>,
  activePath: MessageId[],
): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...pathNodes(map, activePath)
      .filter((n) => n.role !== 'system' && n.status !== 'pending')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
  ];
}
