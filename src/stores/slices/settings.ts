import type { StateCreator } from 'zustand';
import type { AppStore } from '@/stores/createAppStore';
import { initialSettingsState, type SettingsState } from '@/stores/models';

export interface SettingsSlice extends SettingsState {
  setApiKeyState: (apiKey: string, hasApiKey: boolean) => void;
  setDeepThinkState: (deepThink: boolean) => void;
  setWebSearchState: (webSearch: boolean) => void;
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

  setDeepThinkState: (deepThink) =>
    set(
      (state) => {
        state.deepThink = deepThink;
      },
      undefined,
      'settings/setDeepThinkState',
    ),

  setWebSearchState: (webSearch) =>
    set(
      (state) => {
        state.webSearch = webSearch;
      },
      undefined,
      'settings/setWebSearchState',
    ),
});
