import { useState, useEffect, useCallback } from 'react';

export type OutputDirMode = 'working' | 'source' | 'custom';

export interface Settings {
  outputDirMode: OutputDirMode;
  customOutputDir: string | null;
}

const STORAGE_KEY = 'mathcad-settings';
const DEFAULT_SETTINGS: Settings = {
  outputDirMode: 'working',
  customOutputDir: null,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const getOutputDirPath = useCallback(
    (sourceFilePath: string | null): string => {
      // Read current settings from localStorage to ensure we always have the latest values
      // This fixes the issue where separate useSettings instances in different components
      // can have stale state when one component (e.g., BatchSettingsPanel) updates settings
      // but another component (e.g., App.tsx) hasn't re-rendered yet
      let currentSettings = DEFAULT_SETTINGS;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch {
        // Use DEFAULT_SETTINGS on parse errors
      }

      if (currentSettings.outputDirMode === 'custom' && currentSettings.customOutputDir) {
        return currentSettings.customOutputDir;
      }
      if (currentSettings.outputDirMode === 'source' && sourceFilePath) {
        const lastSep = Math.max(
          sourceFilePath.lastIndexOf('/'),
          sourceFilePath.lastIndexOf('\\')
        );
        if (lastSep > 0) {
          return sourceFilePath.substring(0, lastSep);
        }
      }
      // For 'working', backend resolves to server cwd.
      return '';
    },
    []  // Empty deps - always reads fresh from localStorage
  );

  return {
    settings,
    updateSettings,
    getOutputDirPath,
  };
}
