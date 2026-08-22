import type {
  ChatMessage,
  InputImagePart,
  InputTextPart,
  UserContent,
} from '@/features/chat/types/deepseek';
import type { ImageAttachment, MessageId, MessageNode } from '@/stores/models';
import { pathNodes } from '@/stores/utils/tree';

function buildSystemPrompt(): string {
  return 'You are a helpful assistant.';
}

export type ResolvedAttachment =
  | { kind: 'file'; fileId: string }
  | { kind: 'inline'; dataUrl: string };

/** 失败/空取消的 assistant 会留在树上，但不能发给模型。 */
function isSendablePathNode(node: MessageNode): boolean {
  if (node.deleted) return false;
  if (node.role !== 'user' && node.role !== 'assistant') return false;
  if (node.status === 'pending') return false;
  if (node.role === 'assistant' && !node.content) return false;
  return true;
}

function toImagePart(
  attachment: ImageAttachment,
  resolved?: ReadonlyMap<string, ResolvedAttachment>,
): InputImagePart | null {
  const extra = resolved?.get(attachment.id);
  if (extra?.kind === 'file') {
    return { type: 'input_image', file_id: extra.fileId };
  }
  if (attachment.fileId) {
    return { type: 'input_image', file_id: attachment.fileId };
  }
  if (extra?.kind === 'inline') {
    return {
      type: 'input_image',
      image_url: extra.dataUrl,
      detail: 'auto',
    };
  }
  return null;
}

function toUserContent(
  node: MessageNode,
  resolved?: ReadonlyMap<string, ResolvedAttachment>,
): UserContent {
  const attachments = node.attachments ?? [];
  if (attachments.length === 0) return node.content;

  const parts: Array<InputTextPart | InputImagePart> = [];
  if (node.content) {
    parts.push({ type: 'input_text', text: node.content });
  }
  for (const attachment of attachments) {
    const part = toImagePart(attachment, resolved);
    if (part) parts.push(part);
  }
  return parts;
}

export function buildApiMessages(
  map: Map<MessageId, MessageNode>,
  activePath: MessageId[],
  resolved?: ReadonlyMap<string, ResolvedAttachment>,
): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...pathNodes(map, activePath)
      .filter(isSendablePathNode)
      .map((m) =>
        m.role === 'user'
          ? {
              role: 'user' as const,
              content: toUserContent(m, resolved),
            }
          : {
              role: 'assistant' as const,
              content: m.content,
            },
      ),
  ];
}
