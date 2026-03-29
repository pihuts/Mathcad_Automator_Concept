import { useMutation, useQuery } from '@tanstack/react-query';
import { startBatch, getBatchStatus, stopBatch } from '../services/api';
import type { BatchRequest, BatchStatus } from '../services/api';
import { useState, useCallback } from 'react';
import { validateZipMode, type MultiValueInput, type BatchMode } from '../utils/batchIteration';

export type { BatchMode } from '../utils/batchIteration';

export const useBatch = () => {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState<BatchMode>('combination');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<BatchRequest | null>(null);

  const startMutation = useMutation({
    mutationKey: ['startBatch'],
    mutationFn: (config: BatchRequest) => startBatch(config),
    onSuccess: (_, variables) => {
      setCurrentBatchId(variables.batch_id);
    },
  });

  const stopMutation = useMutation({
    mutationKey: ['stopBatch'],
    mutationFn: (id: string) => stopBatch(id),
  });

  const batchQuery = useQuery<BatchStatus>({
    queryKey: ['batch', currentBatchId],
    queryFn: () => getBatchStatus(currentBatchId!),
    enabled: !!currentBatchId,
    refetchInterval: (query) => {
       const status = query.state.data?.status;
       // Stop polling when status is unknown (pre-data) or terminal
       if (status == null) return false;
       const isTerminal = status === 'completed' || status === 'failed' || status === 'stopped' || status === 'cancelled';
       if (!isTerminal) {
         return 1000;
       }
       return false;
    },
  });

  /**
   * Validates the current batch configuration against the selected mode.
   * For Zip mode, ensures all multi-value inputs have the same number of values.
   *
   * @param inputs - Array of MultiValueInput objects from current configuration
   * @returns ValidationResult with valid flag and optional error message
   */
  const validateBatchMode = (inputs: MultiValueInput[]): { valid: boolean; error?: string } => {
    if (batchMode === 'zip') {
      return validateZipMode(inputs);
    }
    return { valid: true };
  };

  /**
   * Prepare batch for execution - shows preview modal instead of starting immediately
   */
  const prepareBatch = useCallback((config: BatchRequest) => {
    setPendingConfig(config);
    setShowPreview(true);
  }, []);

  /**
   * Confirm and start the pending batch
   */
  const confirmBatch = useCallback(() => {
    if (pendingConfig) {
      startMutation.mutate(pendingConfig);
      setShowPreview(false);
      setPendingConfig(null);
    }
  }, [pendingConfig, startMutation]);

  /**
   * Cancel the preview and clear pending config
   */
  const cancelPreview = useCallback(() => {
    setShowPreview(false);
    setPendingConfig(null);
  }, []);

  return {
    startBatch: startMutation.mutate,
    isStarting: startMutation.isPending,
    stopBatch: stopMutation.mutate,
    isStopping: stopMutation.isPending,
    batchData: batchQuery.data,
    isLoading: batchQuery.isLoading,
    currentBatchId,
    batchMode,
    setBatchMode,
    validateBatchMode,
    // Preview state and actions
    showPreview,
    pendingConfig,
    prepareBatch,
    confirmBatch,
    cancelPreview,
  };
};
