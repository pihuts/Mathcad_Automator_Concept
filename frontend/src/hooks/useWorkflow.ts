import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  createWorkflow,
  getWorkflowStatus,
  stopWorkflow,
  WorkflowStatus,
  type OutputDirMode,
} from '../services/api';
import type {
  WorkflowConfig,
  StepResult,
  WorkflowCreatedFile,
  WorkflowResultSummary,
  WorkflowStatusResponse,
} from '../services/api';

interface StoredSettings {
  outputDirMode?: OutputDirMode;
  customOutputDir?: string | null;
}

const SETTINGS_STORAGE_KEY = 'mathcad-settings';

const resolveOutputDir = (mode: OutputDirMode, customDir: string | null | undefined, sourceFilePath: string): string | undefined => {
  if (mode === 'working') {
    return undefined;
  }

  if (mode === 'custom') {
    return customDir || undefined;
  }

  const lastSep = Math.max(sourceFilePath.lastIndexOf('/'), sourceFilePath.lastIndexOf('\\'));
  if (lastSep > 0) {
    return sourceFilePath.substring(0, lastSep);
  }

  return undefined;
};

const normalizeWorkflowPayload = (config: WorkflowConfig): WorkflowConfig => {
  const firstFilePath = config.files[0]?.file_path ?? '';
  let mode: OutputDirMode = 'working';
  let customOutputDir: string | null | undefined = null;

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSettings;
      if (parsed.outputDirMode === 'working' || parsed.outputDirMode === 'source' || parsed.outputDirMode === 'custom') {
        mode = parsed.outputDirMode;
      }
      customOutputDir = parsed.customOutputDir;
    }
  } catch {
    // Ignore settings parse errors and fall back to defaults
  }

  const selectedMode: OutputDirMode = config.output_dir_mode ?? mode;
  const outputDir = config.output_dir ?? resolveOutputDir(selectedMode, customOutputDir, firstFilePath);

  return {
    ...config,
    output_dir_mode: selectedMode,
    output_dir: outputDir,
  };
};

export const useWorkflow = () => {
  const queryClient = useQueryClient();
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [startupWorkflowId, setStartupWorkflowId] = useState<string | null>(null);
  const [startupStartedAt, setStartupStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastVisibleResult, setLastVisibleResult] = useState<{
    stepResults: StepResult[];
    createdFiles: WorkflowCreatedFile[];
    resultSummary: WorkflowResultSummary | null;
  }>({
    stepResults: [],
    createdFiles: [],
    resultSummary: null,
  });
  const isTerminalStatus = (status?: string) =>
    status === WorkflowStatus.COMPLETED ||
    status === WorkflowStatus.FAILED ||
    status === WorkflowStatus.STOPPED;

  // Poll workflow status
  const { data: workflowData, isLoading, error: workflowQueryError } = useQuery({
    queryKey: ['workflow', activeWorkflowId],
    queryFn: async () => {
      console.log('[useWorkflow] Polling workflow status for:', activeWorkflowId);
      const result = await getWorkflowStatus(activeWorkflowId!);
      console.log('[useWorkflow] Poll result:', result?.status, result?.progress);
      return result;
    },
    enabled: !!activeWorkflowId,
    retry: (failureCount, retryError) => {
      if (
        axios.isAxiosError(retryError) &&
        retryError.response?.status === 404 &&
        activeWorkflowId &&
        startupWorkflowId === activeWorkflowId &&
        startupStartedAt !== null
      ) {
        const withinStartupGrace = Date.now() - startupStartedAt < 10000;
        return withinStartupGrace && failureCount < 5;
      }
      return false;
    },
    retryDelay: 500,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      // Stop polling when status is unknown (pre-data) or terminal
      if (status == null) return false;
      return isTerminalStatus(status) ? false : 1000;
    },
  });

  useEffect(() => {
    console.log('[useWorkflow] workflowData changed:', workflowData?.status, workflowData?.workflow_id);
    if (!workflowData || !activeWorkflowId) {
      return;
    }

    if (startupWorkflowId === activeWorkflowId) {
      console.log('[useWorkflow] Clearing startup state because workflowData received');
      setStartupWorkflowId(null);
      setStartupStartedAt(null);
    }
  }, [workflowData, activeWorkflowId, startupWorkflowId]);

  useEffect(() => {
    if (!workflowQueryError || !activeWorkflowId) {
      return;
    }

    if (axios.isAxiosError(workflowQueryError) && workflowQueryError.response?.status === 404) {
      const withinStartupGrace =
        startupWorkflowId === activeWorkflowId &&
        startupStartedAt !== null &&
        Date.now() - startupStartedAt < 10000;

      if (withinStartupGrace) {
        // Freshly created workflow IDs can return transient 404 before registration.
        return;
      }

      // Stop polling stale/deleted workflow IDs to avoid persistent 404 spam.
      setActiveWorkflowId(null);
      setStartupWorkflowId(null);
      setStartupStartedAt(null);
      setError('Workflow run no longer exists.');
      queryClient.removeQueries({ queryKey: ['workflow', activeWorkflowId] });
    }
  }, [workflowQueryError, activeWorkflowId, queryClient, startupWorkflowId, startupStartedAt]);

  // Create workflow mutation
  const createMutation = useMutation({
    mutationFn: (config: WorkflowConfig) => createWorkflow(config),
    onSuccess: (data) => {
      console.log('[useWorkflow] Create workflow success, workflow_id:', data.workflow_id);
      setActiveWorkflowId(data.workflow_id);
      setLastVisibleResult({
        stepResults: [],
        createdFiles: [],
        resultSummary: null,
      });
      setStartupWorkflowId(data.workflow_id);
      setStartupStartedAt(Date.now());
      setError(null);
    },
    onError: (err: any) => {
      console.log('[useWorkflow] Create workflow error:', err.message);
      setStartupWorkflowId(null);
      setStartupStartedAt(null);
      setError(err.message || 'Failed to create workflow');
    },
  });

  // Stop workflow mutation
  const stopMutation = useMutation({
    mutationFn: () => stopWorkflow(activeWorkflowId!),
    onSuccess: () => {
      if (activeWorkflowId) {
        queryClient.invalidateQueries({ queryKey: ['workflow', activeWorkflowId] });
      }
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to stop workflow');
    },
  });


  const createWorkflowHandler = (config: WorkflowConfig) => {
    createMutation.mutate(normalizeWorkflowPayload(config));
  };

  const stopWorkflowHandler = () => {
    if (activeWorkflowId) {
      stopMutation.mutate();
    }
  };


  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    if (!workflowData) return;

    const latestStepResults = Array.isArray(workflowData.step_results) ? workflowData.step_results : [];
    const latestCreatedFiles = Array.isArray(workflowData.created_files) ? workflowData.created_files : [];
    const latestResultSummary = workflowData.result_summary ?? null;

    if (latestStepResults.length === 0 && latestCreatedFiles.length === 0 && !latestResultSummary) {
      return;
    }

    setLastVisibleResult((prev) => {
      const next = {
        stepResults: latestStepResults.length > 0 ? latestStepResults : prev.stepResults,
        createdFiles: latestCreatedFiles.length > 0 ? latestCreatedFiles : prev.createdFiles,
        resultSummary: latestResultSummary ?? prev.resultSummary,
      };
      return next;
    });
  }, [workflowData]);

  const mergedWorkflowData: WorkflowStatusResponse | undefined = workflowData
    ? {
        ...workflowData,
        step_results:
          Array.isArray(workflowData.step_results) && workflowData.step_results.length > 0
            ? workflowData.step_results
            : lastVisibleResult.stepResults,
        created_files:
          Array.isArray(workflowData.created_files) && workflowData.created_files.length > 0
            ? workflowData.created_files
            : lastVisibleResult.createdFiles,
        result_summary: workflowData.result_summary ?? lastVisibleResult.resultSummary ?? undefined,
      }
    : undefined;

  // Derive step results and pause state from workflowData
  const stepResults: StepResult[] = mergedWorkflowData?.step_results || [];
  const createdFiles = mergedWorkflowData?.created_files || [];
  const resultSummary = mergedWorkflowData?.result_summary || null;
  const isPaused = workflowData?.status === WorkflowStatus.PAUSED;
  const pausedAtStep = workflowData?.paused_at_step ?? null;

  return {
    // Existing
    createWorkflow: createWorkflowHandler,
    stopWorkflow: stopWorkflowHandler,
    workflowData: mergedWorkflowData,
    activeWorkflowId,
    isLoading,
    isStarting:
      createMutation.isPending ||
      (activeWorkflowId !== null &&
        startupWorkflowId === activeWorkflowId &&
        startupStartedAt !== null &&
        Date.now() - startupStartedAt < 10000),
    error,
    clearError,
    isCreating: createMutation.isPending,
    isStopping: stopMutation.isPending,
    // Phase 7 additions
    stepResults,
    isPaused,
    pausedAtStep,
    createdFiles,
    resultSummary,
  };
};
