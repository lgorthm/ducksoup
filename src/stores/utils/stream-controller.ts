import type { ChatStreamController } from '@/features/chat/utils/chat-stream';

let activeController: ChatStreamController | null = null;

export function getActiveController(): ChatStreamController | null {
  return activeController;
}

export function setActiveController(
  controller: ChatStreamController | null,
): void {
  activeController = controller;
}
