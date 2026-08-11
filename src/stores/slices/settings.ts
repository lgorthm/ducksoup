import type { StateCreator } from 'zustand';
import type { AppStore } from '@/stores/createAppStore';
import {
  initialSettingsState,
  type ModelName,
  type SettingsState,
} from '@/stores/models';

export interface SettingsSlice extends SettingsState {
  setApiKeyState: (apiKey: string, hasApiKey: boolean) => void;
  setModelState: (model: ModelName) => void;
  setDeepThinkState: (deepThink: boolean) => void;
}

export type SliceCreator<T> = StateCreator<
  AppStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  T
>;

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set) => ({
  ...initialSettingsState,

  setApiKeyState: (apiKey, hasApiKey) =>
    set(
      (state) => {
        state.apiKey = apiKey;
        state.hasApiKey = hasApiKey;
      },
      undefined,
      'settings/setApiKeyState',
    ),

  setModelState: (model) =>
    set(
      (state) => {
        state.selectedModel = model;
      },
      undefined,
      'settings/setModelState',
    ),

  setDeepThinkState: (deepThink) =>
    set(
      (state) => {
        state.deepThink = deepThink;
      },
      undefined,
      'settings/setDeepThinkState',
    ),
});
