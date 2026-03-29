// frontend/src/constants/storageKeys.ts
/**
 * Centralized localStorage key definitions.
 * Prevents key collisions and enables type-safe storage access.
 */

export const STORAGE_KEYS = {
  // Settings
  SETTINGS: 'mathcad-settings',

  // Workflow
  WORKFLOW_STATE: 'workflow-state',

  // UI preferences
  PANEL_LAYOUT: 'panel-layout',
  THEME_MODE: 'theme-mode',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
