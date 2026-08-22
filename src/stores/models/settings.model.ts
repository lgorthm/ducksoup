export interface SettingsState {
  apiKey: string;
  hasApiKey: boolean;
  deepThink: boolean;
}

export const initialSettingsState: SettingsState = {
  apiKey: '',
  hasApiKey: false,
  deepThink: false,
};
