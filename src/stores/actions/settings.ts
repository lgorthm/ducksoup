import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import { API_KEY_STORAGE_KEY } from '@/stores/utils/constants';
import * as db from '@/features/chat/utils/db';

export function setApiKey(key: string) {
  const name = createActionName('settings', setApiKey);
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  useStore.setState(
    (state) => {
      state.apiKey = key;
      state.hasApiKey = true;
    },
    undefined,
    name(),
  );
}

export function clearApiKey() {
  const name = createActionName('settings', clearApiKey);
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  useStore.setState(
    (state) => {
      state.apiKey = '';
      state.hasApiKey = false;
      for (const node of state.messageNodes.values()) {
        if (!node.attachments?.some((a) => a.fileId)) continue;
        node.attachments = node.attachments.map((a) => ({
          id: a.id,
          mime: a.mime,
          width: a.width,
          height: a.height,
          byteLength: a.byteLength,
          blobKey: a.blobKey,
          filename: a.filename,
        }));
      }
    },
    undefined,
    name(),
  );
  void db.stripAllAttachmentFileIds();
}

export function toggleDeepThink() {
  const name = createActionName('settings', toggleDeepThink);
  useStore.setState(
    (state) => {
      state.deepThink = !state.deepThink;
    },
    undefined,
    name(),
  );
}
