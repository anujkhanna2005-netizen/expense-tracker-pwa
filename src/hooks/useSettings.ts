import { useSettingsStore } from '../stores/settingsStore';

export function useSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const isFirstLaunch = useSettingsStore((state) => state.isFirstLaunch);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return {
    settings,
    isFirstLaunch,
    updateSettings
  };
}
export default useSettings;
