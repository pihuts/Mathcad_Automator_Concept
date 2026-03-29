// frontend/src/hooks/shared/usePersistedState.ts
import { useState, useCallback } from 'react';
import type { StorageKey } from '../../constants/storageKeys';

/**
 * Hook for state that persists to localStorage.
 * Consolidates localStorage patterns from useSettings and useOptimizer.
 *
 * @param key - Storage key from STORAGE_KEYS
 * @param defaultValue - Default value if key not in storage
 * @returns [value, setValue] tuple like useState
 */
export function usePersistedState<T>(
  key: StorageKey | string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize from localStorage or default
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for key "${key}":`, error);
    }
    return defaultValue;
  });

  // Wrap setState to also persist
  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error) {
          console.warn(`Failed to persist state for key "${key}":`, error);
        }
        return newValue;
      });
    },
    [key]
  );

  return [state, setPersistedState];
}
