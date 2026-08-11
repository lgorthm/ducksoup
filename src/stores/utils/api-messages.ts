import type {
  ChatMessage,
  StoredMessage,
} from '@/features/chat/types/deepseek';

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

export function buildApiMessages(path: StoredMessage[]): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...path.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];
}
