import { useStore } from '@/stores';
import type { ModelName } from '@/stores/models';
import { createActionName } from '@/stores/utils/actionName';
import { API_KEY_STORAGE_KEY } from '@/stores/utils/constants';

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
    },
    undefined,
    name(),
  );
}

export function setModel(model: ModelName) {
  const name = createActionName('settings', setModel);
  useStore.setState(
    (state) => {
      state.selectedModel = model;
    },
    undefined,
    name(),
  );
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
