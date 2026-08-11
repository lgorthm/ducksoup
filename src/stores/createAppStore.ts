import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  createConversationSlice,
  createMessageSlice,
  createSettingsSlice,
  type ConversationSlice,
  type MessageSlice,
  type SettingsSlice,
} from '@/stores/slices';

export type AppStore = SettingsSlice & ConversationSlice & MessageSlice;

export const useStore = create<AppStore>()(
  devtools(
    immer((...a) => ({
      ...createSettingsSlice(...a),
      ...createConversationSlice(...a),
      ...createMessageSlice(...a),
    })),
    { name: 'AppStore' },
  ),
);
