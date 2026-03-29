import { useState, useEffect, useCallback } from 'react';

interface BatchState {
  batch_id: string;
  total: number;
  completed: number;
  status: string;
}

interface RecoveryState {
  has_active_processes: boolean;
  batches?: Record<string, BatchState>;
  workflow_checkpoints?: string[];
  opened_files?: string[];
}

export const useRecovery = () => {
  const [recoveryState, setRecoveryState] = useState<RecoveryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRecovery = async () => {
      console.log('[useRecovery] checkRecovery: starting...');
      try {
        const response = await fetch('/api/v1/recovery/state');
        const state: RecoveryState = await response.json();
        console.log('[useRecovery] checkRecovery: got state:', state);
        if (state.has_active_processes) {
          console.log('[useRecovery] checkRecovery: has_active_processes=true, setting state');
          setRecoveryState(state);
        } else {
          console.log('[useRecovery] checkRecovery: has_active_processes=false, not setting state');
        }
      } catch (error) {
        console.error('[useRecovery] checkRecovery: Failed to check recovery state:', error);
      } finally {
        setLoading(false);
      }
    };

    checkRecovery();
  }, []);

  const clearRecovery = useCallback(() => {
    console.log('[useRecovery] clearRecovery called');
    setRecoveryState(null);
  }, []); // Empty deps because setRecoveryState is stable

  return { recoveryState, loading, clearRecovery };
};
