import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Tabs,
  Tab,
  Button,
  IconButton,
  Badge,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Switch,
  Fab,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  FileCopy as FileIcon,
  Folder as FolderIcon,
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
  FileUpload as FileUploadIcon,
  MergeType as MergeTypeIcon,
  Refresh as RefreshIcon,
  ListAlt as ListAltIcon,
} from '@mui/icons-material';
import { BatchResultsList } from './components/BatchResultsList'
import { BatchResultsTable } from './components/BatchResultsTable'
import { InputPillCard } from './components/InputPillCard'
import { OutputPillCard } from './components/OutputPillCard'
import { CompactStatusCard } from './components/CompactStatusCard'
import { InputModal } from './components/InputModal'
import { LibraryModal } from './components/LibraryModal'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy load heavy views for better initial bundle size
const WorkflowView = lazy(() => import('./components/WorkflowView').then(m => ({ default: m.WorkflowView })))

// Loading fallback component
const ViewLoader = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
    <CircularProgress size={48} />
  </Box>
)
import { useBatch } from './hooks/useBatch'
import { useWorkflow } from './hooks/useWorkflow'
import { useSettings } from './hooks/useSettings'
import { usePanelLayout } from './hooks/usePanelLayout'
import { useCsvSources } from './hooks/useCsvSources'
import { useRecovery } from './hooks/useRecovery'
import { RecoveryModal } from './components/RecoveryModal'
import { BatchPreviewModal } from './components/BatchPreviewModal'
import { BatchModeSelector } from './components/BatchModeSelector'
import { BatchSettingsPanel } from './components/BatchSettingsPanel'
import { type MultiValueInput, calculateIterationCount, generateIterations } from './utils/batchIteration'
import { normalizeAlias } from './utils/workflowAutoMapping'
import { getInputs, browseFile, openFile } from './services/api'
import { UNIT_PRESETS } from './constants/units'
import type { WorkflowFile, FileMapping, MetaData, WorkflowConfig, InputConfig, ConditionalTermination } from './services/api'
import { tokens } from './theme/mui-theme'

type WorkflowSchemaChange = {
  file_path: string;
  file_name: string;
  added_inputs: string[];
  removed_inputs: string[];
  added_outputs: string[];
  removed_outputs: string[];
};

function App() {
  const [opened, setOpened] = useState(false)
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [filePath, setFilePath] = useState('')
  const [aliases, setAliases] = useState<{ alias: string, name: string }[]>([])
  const [batchOutputs, setBatchOutputs] = useState<{ alias: string, name: string }[]>([])
  const [aliasConfigs, setAliasConfigs] = useState<Record<string, any[] | string>>({})
  const [aliasUnits, setAliasUnits] = useState<Record<string, string>>({})
  const [aliasTypes, setAliasTypes] = useState<Record<string, 'number' | 'string'>>({})
  const [batchOutputUnits, setBatchOutputUnits] = useState<Record<string, string>>({})
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [exportPdf, setExportPdf] = useState(false);
  const [exportMcdx, setExportMcdx] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [libraryOpened, setLibraryOpened] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Phase 4.1: Batch settings drawer state
  const [batchSettingsOpen, setBatchSettingsOpen] = useState(false);

  // Workflow state
  const [activeTab, setActiveTab] = useState<string>('batch');
  const [workflowFiles, setWorkflowFilesState] = useState<WorkflowFile[]>([]);
  const [workflowRunShortcutSignal, setWorkflowRunShortcutSignal] = useState(0);

  // Debug wrapper for setWorkflowFiles
  const setWorkflowFiles = useCallback((newFiles: WorkflowFile[]) => {
    setWorkflowFilesState(newFiles);
  }, []);

  const [workflowMappings, setWorkflowMappings] = useState<FileMapping[]>([]);
  const [filesMetadata, setFilesMetadata] = useState<Record<string, MetaData>>({});
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isWorkflowPreflightRunning, setIsWorkflowPreflightRunning] = useState(false);
  const [workflowSchemaChanges, setWorkflowSchemaChanges] = useState<WorkflowSchemaChange[]>([]);
  const [workflowSchemaConfirmOpen, setWorkflowSchemaConfirmOpen] = useState(false);
  const [pendingWorkflowConfig, setPendingWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [workflowIterationMode, setWorkflowIterationMode] = useState<'combination' | 'zip'>('combination');

  // Phase 7: Workflow overhaul state
  const [failureMode, setFailureMode] = useState<string>('stop_on_error');
  const [pauseMode, setPauseMode] = useState<string>('auto_run');
  const [retryMaxRetries] = useState<number>(3);
  const [conditions, _setConditions] = useState<ConditionalTermination[]>([]);

  // Phase 8.1: Three-panel layout state management
  const { state: panelState, setSelectedPill } = usePanelLayout();

  // Phase 8.3: CSV Data Sources
  const {
    files: csvFiles,
    addFiles: addCsvFiles,
    removeFile: _removeCsvFile,
    removeReference: removeCsvReference,
    getColumnsGrouped: getCsvColumnsGrouped,
    addReference: addCsvReference,
    getColumnValues: getCsvColumnValues,
    clearAll: clearCsvFiles,
  } = useCsvSources();

  const {
    batchData,
    currentBatchId,
    stopBatch,
    isStopping: isBatchStopping,
    isStarting: isBatchStarting,
    batchMode,
    setBatchMode,
    validateBatchMode,
    showPreview,
    prepareBatch,
    confirmBatch,
    cancelPreview,
  } = useBatch()

  const {
    settings,
    getOutputDirPath,
  } = useSettings()

  const {
    createWorkflow,
    stopWorkflow,
    workflowData,
    activeWorkflowId,
    isStopping,
    isCreating,
    isStarting,
    isLoading: isWorkflowLoading,
    error: workflowRunError,
    clearError: clearWorkflowRunError,
    // Phase 7
    stepResults,
    isPaused,
  } = useWorkflow();

  const isWorkflowSettings = activeTab === 'workflow';
  const settingsExportPdf = exportPdf;
  const settingsExportMcdx = exportMcdx;

  // Phase 11.5: Recovery state detection
  const { recoveryState, loading: recoveryLoading, clearRecovery } = useRecovery();

  const progress = batchData ? (batchData.total > 0 ? (batchData.completed / batchData.total) * 100 : 0) : 0;
  const visibleWorkflowError = workflowError || workflowRunError;
  const isWorkflowRunning =
    isWorkflowPreflightRunning ||
    isStarting ||
    isCreating ||
    workflowData?.status === 'running' ||
    workflowData?.status === 'pending' ||
    (isWorkflowLoading && !!activeWorkflowId);

  // Recovery handlers - wrap in useCallback to maintain stable references
  const handleContinueRecovery = useCallback(() => {
    // If there are running batches, navigate to batch tab
    if (recoveryState?.batches && Object.keys(recoveryState.batches).length > 0) {
      setActiveTab('batch');
    }

    // If there are running workflows, navigate to workflow tab
    if (recoveryState?.workflow_checkpoints && recoveryState.workflow_checkpoints.length > 0) {
      setActiveTab('workflow');
    }

    // Clear the modal - hooks will detect running state via their initial status checks
    clearRecovery();
  }, [clearRecovery, recoveryState]);

  const handleDiscardRecovery = useCallback(async () => {
    // TODO: Call API to clear recovery state
    clearRecovery();
  }, [clearRecovery]);

  // Handler for when a file is selected in the workflow
  // NOTE: Removed automatic metadata scanning here - analysis now only happens
  // when user explicitly clicks "Analyze" or runs the workflow to avoid
  // waiting time while setting up steps
  const handleWorkflowFileSelected = async (filePath: string) => {
    // No-op: analysis is now deferred until user explicitly requests it
    // This avoids opening Mathcad and waiting when browsing files
    console.log('[handleWorkflowFileSelected] File selected:', filePath, '- deferred analysis');
  };

  // Handler for analyzing all workflow files at once
  const handleWorkflowAnalyzeAll = async (filePaths: string[]) => {
    setWorkflowError(null);

    for (const filePath of filePaths) {
      try {
        const meta = await getInputs(filePath);
        setFilesMetadata(prev => ({
          ...prev,
          [filePath]: meta,
        }));

      } catch (err: any) {
        const errorMsg = `Failed to analyze ${filePath.split('\\').pop()}: ${err.response?.data?.detail || err.message || 'Unknown error'}`;
        console.error(errorMsg);
        setWorkflowError(errorMsg);
        // Continue analyzing other files even if one fails
      }
    }
  };

  const handleRunWorkflow = async () => {
    if (workflowFiles.length === 0) return;
    setWorkflowError(null);
    setIsWorkflowPreflightRunning(true);

    try {
      // Always re-analyze every step right before run to prevent stale input/mapping configs.
      const latestMetadata: Record<string, MetaData> = { ...filesMetadata };
      const validFilePaths = workflowFiles
        .map((f) => f.file_path)
        .filter((p): p is string => !!p);

      for (const filePath of validFilePaths) {
        try {
          latestMetadata[filePath] = await getInputs(filePath);
        } catch (err: any) {
          const errorMsg = `Failed to analyze ${filePath.split('\\').pop()}: ${err.response?.data?.detail || err.message || 'Unknown error'}`;
          console.error(errorMsg);
          setWorkflowError(errorMsg);
          return;
        }
      }

      setFilesMetadata((prev) => ({ ...prev, ...latestMetadata }));

      const workflowSchemaDiffs: WorkflowSchemaChange[] = validFilePaths.flatMap((filePath) => {
        const previous = filesMetadata[filePath];
        const current = latestMetadata[filePath];
        if (!previous || !current) {
          return [];
        }

        const prevInputs = new Set((previous.inputs ?? []).map((i) => i.alias));
        const prevOutputs = new Set((previous.outputs ?? []).map((o) => o.alias));
        const currInputs = new Set((current.inputs ?? []).map((i) => i.alias));
        const currOutputs = new Set((current.outputs ?? []).map((o) => o.alias));

        const addedInputs = [...currInputs].filter((alias) => !prevInputs.has(alias));
        const removedInputs = [...prevInputs].filter((alias) => !currInputs.has(alias));
        const addedOutputs = [...currOutputs].filter((alias) => !prevOutputs.has(alias));
        const removedOutputs = [...prevOutputs].filter((alias) => !currOutputs.has(alias));

        if (
          addedInputs.length === 0 &&
          removedInputs.length === 0 &&
          addedOutputs.length === 0 &&
          removedOutputs.length === 0
        ) {
          return [];
        }

        return [{
          file_path: filePath,
          file_name: filePath.split('\\').pop() || filePath,
          added_inputs: addedInputs.sort(),
          removed_inputs: removedInputs.sort(),
          added_outputs: addedOutputs.sort(),
          removed_outputs: removedOutputs.sort(),
        }];
      });

      const experimentalAliasNormalized = normalizeAlias('experimental_input');
      // Reconcile per-step inputs against latest designated worksheet inputs.
      const reconciledWorkflowFiles = workflowFiles.map((wf) => {
        const meta = latestMetadata[wf.file_path];
        if (!meta) {
          return wf;
        }

        const designatedInputs = meta.inputs ?? [];
        const designatedInputAliasSet = new Set(designatedInputs.map((i) => i.alias));
        const removedInputs = (wf.inputs ?? []).filter((inp) => !designatedInputAliasSet.has(inp.alias));
        removedInputs.forEach((inp) => removeCsvReference(wf.position, inp.alias));

        const filteredInputs = (wf.inputs ?? []).filter((inp) => designatedInputAliasSet.has(inp.alias));
        const hasExperimentalInWorksheet = designatedInputs.some(
          (inp) => normalizeAlias(inp.alias) === experimentalAliasNormalized
        );
        const hasExperimentalConfigured = filteredInputs.some(
          (inp) => normalizeAlias(inp.alias) === experimentalAliasNormalized
        );

        // Keep workflow step data in sync when experimental_input is added/removed.
        if (hasExperimentalInWorksheet && !hasExperimentalConfigured) {
          const experimentalMeta = designatedInputs.find(
            (inp) => normalizeAlias(inp.alias) === experimentalAliasNormalized
          );
          if (experimentalMeta) {
            filteredInputs.push({
              alias: experimentalMeta.alias,
              value: [],
              inputType: 'string',
            });
          }
        } else if (!hasExperimentalInWorksheet && hasExperimentalConfigured) {
          const removedExperimental = filteredInputs.find(
            (inp) => normalizeAlias(inp.alias) === experimentalAliasNormalized
          );
          if (removedExperimental) {
            removeCsvReference(wf.position, removedExperimental.alias);
          }
        }

        return { ...wf, inputs: filteredInputs };
      });

      const inputAliasSetByFile = new Map<string, Set<string>>();
      const sourceAliasSetByFile = new Map<string, Set<string>>();
      for (const file of reconciledWorkflowFiles) {
        const meta = latestMetadata[file.file_path];
        const inputAliases = new Set((meta?.inputs ?? []).map((i) => i.alias));
        const sourceAliases = new Set([
          ...(meta?.inputs ?? []).map((i) => i.alias),
          ...(meta?.outputs ?? []).map((o) => o.alias),
        ]);
        inputAliasSetByFile.set(file.file_path, inputAliases);
        sourceAliasSetByFile.set(file.file_path, sourceAliases);
      }

      // Remove stale mappings that reference aliases no longer present in current metadata.
      const reconciledMappings = workflowMappings.filter((m) => {
        const sourceAliases = sourceAliasSetByFile.get(m.source_file);
        const targetAliases = inputAliasSetByFile.get(m.target_file);
        if (!sourceAliases || !targetAliases) return false;
        return sourceAliases.has(m.source_alias) && targetAliases.has(m.target_alias);
      });

      setWorkflowFiles(reconciledWorkflowFiles);
      setWorkflowMappings(reconciledMappings);

      // Resolve CSV references in workflow files before submitting
      const resolvedWorkflowFiles = reconciledWorkflowFiles.map(wf => ({
        ...wf,
        inputs: (() => {
          const resolvedInputs = (wf.inputs ?? []).map(inp => {
            // Check if value is a CSV reference string
            const resolvedValues = resolveCsvReference(inp.value, inp.inputType);
            return {
              ...inp,
              value: resolvedValues,
            };
          });

          const metaInputs = latestMetadata[wf.file_path]?.inputs ?? [];
          const experimentalMeta = metaInputs.find(inp => normalizeAlias(inp.alias) === experimentalAliasNormalized);
          if (experimentalMeta) {
            const hasExperimental = resolvedInputs.some(inp => normalizeAlias(inp.alias) === experimentalAliasNormalized);
            if (!hasExperimental) {
              resolvedInputs.push({
                alias: experimentalMeta.alias,
                value: [],
                inputType: 'string',
              });
            }
          }

          return resolvedInputs;
        })(),
      }));

      const workflowConfig: WorkflowConfig = {
        name: `workflow-${Date.now()}`,
        files: resolvedWorkflowFiles,
        mappings: reconciledMappings,
        stop_on_error: failureMode === 'stop_on_error',
        export_pdf: exportPdf,
        export_mcdx: exportMcdx,
        iteration_mode: workflowIterationMode,
        // Phase 7 fields
        failure_mode: failureMode,
        retry_config: failureMode === 'retry' ? {
          max_retries: retryMaxRetries,
          min_wait: 4,
          max_wait: 10,
          multiplier: 1,
        } : undefined,
        pause_mode: pauseMode,
        conditions: conditions.length > 0 ? conditions : undefined,
      };

      if (workflowSchemaDiffs.length > 0) {
        setWorkflowSchemaChanges(workflowSchemaDiffs);
        setPendingWorkflowConfig(workflowConfig);
        setWorkflowSchemaConfirmOpen(true);
        return;
      }

      createWorkflow(workflowConfig);
    } finally {
      setIsWorkflowPreflightRunning(false);
    }
  };

  const handleConfirmWorkflowRunAfterSchemaUpdate = useCallback(() => {
    if (!pendingWorkflowConfig) {
      setWorkflowSchemaConfirmOpen(false);
      setWorkflowSchemaChanges([]);
      return;
    }
    createWorkflow(pendingWorkflowConfig);
    setPendingWorkflowConfig(null);
    setWorkflowSchemaChanges([]);
    setWorkflowSchemaConfirmOpen(false);
  }, [createWorkflow, pendingWorkflowConfig]);

  const handleCancelWorkflowRunAfterSchemaUpdate = useCallback(() => {
    setPendingWorkflowConfig(null);
    setWorkflowSchemaChanges([]);
    setWorkflowSchemaConfirmOpen(false);
  }, []);

  const workflowSummaryData = useMemo(() => {
    const steps: Array<{ index: number; fileName: string; inputCount: number; outputCount: number; type: 'calculation' }> = [];

    // Add calculation steps
    workflowFiles.forEach((f) => {
      steps.push({
        index: f.position + 1,
        fileName: f.file_path.split('\\').pop() || 'No file',
        inputCount: filesMetadata[f.file_path]?.inputs?.length || 0,
        outputCount: filesMetadata[f.file_path]?.outputs?.length || 0,
        type: 'calculation' as const,
      });
    });

    steps.sort((a, b) => a.index - b.index);

    const mappingChains = workflowMappings.map(m => {
      const sourceStep = workflowFiles.find(f => f.file_path === m.source_file);
      const targetStep = workflowFiles.find(f => f.file_path === m.target_file);
      return {
        from: `Step ${(sourceStep?.position ?? 0) + 1}: ${m.source_alias}`,
        to: `Step ${(targetStep?.position ?? 0) + 1}: ${m.target_alias}`,
        via: 'mapping',
      };
    });

    const toIdentityKey = (value: unknown): string => {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    // Compute total iterations from per-step modes:
    // combination = product of unique values per input (empty lists ignored),
    // zip = unique row count (after pairing by row, empty lists ignored).
    let totalIterations = 1;
    workflowFiles.forEach(f => {
      const valueLists = (f.inputs || [])
        .map((ic) => Array.isArray(ic.value) ? ic.value : [ic.value])
        .filter((values) => values.length > 0);

      if (valueLists.length === 0) {
        return;
      }

      let stepIterations = 1;
      const stepMode = f.mode ?? workflowIterationMode;
      if (stepMode === 'zip') {
        const multi = valueLists.filter((values) => values.length > 1);
        const rowCount = multi.length > 0 ? multi[0].length : 1;
        const seenRows = new Set<string>();
        for (let rowIdx = 0; rowIdx < rowCount; rowIdx += 1) {
          const row = valueLists.map((values) => {
            if (values.length > 1) return values[rowIdx];
            return values[0];
          });
          seenRows.add(toIdentityKey(row));
        }
        stepIterations = Math.max(1, seenRows.size);
      } else {
        stepIterations = valueLists
          .map((values) => new Set(values.map((value) => toIdentityKey(value))).size)
          .reduce((acc, len) => acc * Math.max(1, len), 1);
      }
      totalIterations *= Math.max(1, stepIterations);
    });

    // Validation warnings
    const warnings: string[] = [];
    workflowFiles.forEach(f => {
      const meta = filesMetadata[f.file_path];
      if (meta) {
        const unmappedInputs = meta.inputs.filter(inp => {
          const hasMapping = workflowMappings.some(m => m.target_file === f.file_path && m.target_alias === inp.alias);
          const hasValue = f.inputs?.some(ic => ic.alias === inp.alias);
          return !hasMapping && !hasValue;
        });
        if (unmappedInputs.length > 0) {
          const stepNum = f.position + 1;
          warnings.push(`Step ${stepNum} has ${unmappedInputs.length} unconfigured input(s): ${unmappedInputs.map(i => i.alias).join(', ')}`);
        }
      }
    });

    return { steps, mappingChains, totalIterations, warnings };
  }, [workflowFiles, workflowMappings, filesMetadata, workflowIterationMode]);

  const handleLoadLibraryConfig = (config: {
    inputs: InputConfig[];
    exportPdf: boolean;
    exportMcdx: boolean;
  }) => {
    // Convert InputConfig[] back to aliasConfigs structure
    // InputConfig has: { alias: "Input1", value: [1,2,3,4,5,6,7,8,9,10], units: "in" }
    // Need to convert to: { "Input1": [1,2,3,4,5,6,7,8,9,10] }
    const newAliasConfigs: Record<string, any[]> = {};
    const newAliasUnits: Record<string, string> = {};
    const newAliasTypes: Record<string, 'number' | 'string'> = {};

    config.inputs.forEach((inputConfig) => {
      // inputConfig.value is already an array like [1,2,3,4,5,6,7,8,9,10]
      newAliasConfigs[inputConfig.alias] = Array.isArray(inputConfig.value)
        ? inputConfig.value
        : [inputConfig.value];

      if (inputConfig.units) {
        newAliasUnits[inputConfig.alias] = inputConfig.units;
      }

      // Detect type from value
      const values = Array.isArray(inputConfig.value) ? inputConfig.value : [inputConfig.value];
      const isString = values.length > 0 && typeof values[0] === 'string';
      newAliasTypes[inputConfig.alias] = isString ? 'string' : 'number';
    });

    setAliasConfigs(newAliasConfigs);
    setAliasUnits(newAliasUnits);
    setAliasTypes(newAliasTypes);
    setExportPdf(config.exportPdf);
    setExportMcdx(config.exportMcdx);
  };

  const workflowProgress = workflowData ? workflowData.progress : 0;

  const handleAnalyze = async (path?: string) => {
    const targetPath = path ?? filePath;
    if (!targetPath) return;
    setError(null);
    setIsAnalyzing(true);
    try {
      const meta = await getInputs(targetPath);
      setAliases(meta.inputs);
      setBatchOutputs(meta.outputs || []);

      // Warn if file has no inputs AND no outputs
      if (meta.inputs.length === 0 && meta.outputs.length === 0) {
        setWarning(`No inputs or outputs detected in ${targetPath.split('\\').pop()}. The file may not be a valid Mathcad worksheet for batch processing.`);
      } else {
        setWarning(null);
      }

      // Filter out stale input configurations that don't exist in the new file
      // This prevents inputs from file A being applied to file B
      const newInputAliases = new Set(meta.inputs.map(i => i.alias));
      setAliasConfigs(prev => {
        const filtered: Record<string, any[] | string> = {};
        for (const [alias, config] of Object.entries(prev)) {
          if (newInputAliases.has(alias)) {
            filtered[alias] = config;
          }
        }
        return filtered;
      });
      setAliasUnits(prev => {
        const filtered: Record<string, string> = {};
        for (const [alias, units] of Object.entries(prev)) {
          if (newInputAliases.has(alias)) {
            filtered[alias] = units;
          }
        }
        return filtered;
      });
      setAliasTypes(prev => {
        const filtered: Record<string, 'number' | 'string'> = {};
        for (const [alias, type] of Object.entries(prev)) {
          if (newInputAliases.has(alias)) {
            filtered[alias] = type;
          }
        }
        return filtered;
      });
    } catch (err: any) {
      console.error("Failed to analyze file", err);
      // Try to extract useful message
      const msg = err.response?.data?.detail || err.message || "Failed to analyze file";
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !filePath) return;

    try {
      // Also add to global CSV sources for InputModal's CSV tab
      // This allows users to manually select columns even if auto-mapping fails
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      await addCsvFiles(dataTransfer.files);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setError('CSV file must have header row and at least one data row');
        return;
      }

      // Parse header to get column names (aliases)
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      // Create case-insensitive alias map
      const aliasMap = new Map<string, string>();
      aliases.forEach(a => aliasMap.set(a.alias.toLowerCase(), a.alias));

      // Parse data rows into values per alias
      const newConfigs: Record<string, any[]> = {};

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        headers.forEach((header, idx) => {
          const val = values[idx];
          if (!val) return;

          // Try to match header to alias (case-insensitive)
          const matchedAlias = aliasMap.get(header.toLowerCase());
          if (!matchedAlias) return;

          if (!newConfigs[matchedAlias]) newConfigs[matchedAlias] = [];

          // Try to parse as number, otherwise keep as string
          const num = parseFloat(val);
          newConfigs[matchedAlias].push(isNaN(num) ? val : num);
        });
      }

      // Check if any aliases were matched
      const matchedCount = Object.keys(newConfigs).length;
      if (matchedCount === 0) {
        // Don't show error - CSV is now in global sources, user can use InputModal to select columns manually
        setError(null);
        return;
      }

      // Update aliasConfigs with parsed data
      setAliasConfigs(prev => ({ ...prev, ...newConfigs }));
      setError(null);
    } catch (err: any) {
      console.error('Failed to parse CSV', err);
      setError(`Failed to parse CSV: ${err.message}`);
    }

    // Reset file input
    event.target.value = '';
  };


  const handleConfigureAlias = (alias: string) => {
    setSelectedAlias(alias);
    setOpened(true);
  }

  const handleSaveAliasConfig = (alias: string, config: any) => {
    // Handle InputConfig object {alias, value, units, inputType, csvSource} from InputModal
    const values = Array.isArray(config) ? config : config.value;
    const units = Array.isArray(config) ? undefined : config.units;
    const inputType = Array.isArray(config) ? undefined : config.inputType;
    // Note: csvSource is stored in config but batch tab doesn't need to track it separately
    // since values like "csv:fileId:column" are stored directly in aliasConfigs

    // Determine input type:
    // 1. Use explicit inputType from InputModal if provided (preferred - user's actual selection)
    // 2. Otherwise fall back to inferring from value contents
    let resolvedType: 'number' | 'string';
    if (inputType) {
      resolvedType = inputType;
    } else {
      // Fallback: infer from value (used for legacy configs without inputType)
      resolvedType = (Array.isArray(values) ? typeof values[0] === 'string' : typeof values === 'string') ? 'string' : 'number';
    }

    setAliasConfigs(prev => ({ ...prev, [alias]: values }));
    setAliasTypes(prev => ({ ...prev, [alias]: resolvedType }));
    if (units) {
      setAliasUnits(prev => ({ ...prev, [alias]: units }));
    }
    setOpened(false);
  }

  // Helper to resolve CSV references (csv:fileId:column) to actual values
  // typeHint: 'number' or 'string' - determines how values are parsed
  const resolveCsvReference = useCallback((value: any, typeHint?: 'number' | 'string'): any[] => {
    if (typeof value === 'string' && value.startsWith('csv:')) {
      const parts = value.split(':');
      if (parts.length >= 3) {
        const fileId = parts[1];
        const column = parts.slice(2).join(':'); // Handle column names with colons
        const resolvedValues = getCsvColumnValues(fileId, column);
        if (resolvedValues.length > 0) {
          // Apply type conversion based on typeHint
          if (typeHint === 'number') {
            const numericValues = resolvedValues
              .map(v => {
                const num = Number(v);
                return isNaN(num) ? null : num;
              })
              .filter((v): v is number => v !== null);
            if (numericValues.length < resolvedValues.length) {
              console.warn(`[resolveCsvReference] Filtered out ${resolvedValues.length - numericValues.length} non-numeric values for column "${column}"`);
            }
            return numericValues;
          }
          // For strings, ensure all values are strings
          return resolvedValues.map(v => String(v ?? '').trim()).filter(v => v.length > 0);
        }
        console.warn(`[resolveCsvReference] CSV reference not resolved: ${value}`);
      }
      return [value]; // Return as-is if can't resolve
    }
    return Array.isArray(value) ? value : [value];
  }, [getCsvColumnValues]);

  const iterationCount = useMemo(() => {
    const keys = Object.keys(aliasConfigs);
    if (keys.length === 0) return 0;

    // Convert aliasConfigs to MultiValueInput format for calculateIterationCount
    // Resolve any CSV references to actual values with type conversion
    const inputs: MultiValueInput[] = keys.map(key => ({
      alias: key,
      values: resolveCsvReference(aliasConfigs[key], aliasTypes[key]),
    }));

    return calculateIterationCount(inputs, batchMode);
  }, [aliasConfigs, aliasTypes, batchMode, resolveCsvReference]);

  const iterationBreakdown = useMemo(() => {
    const keys = Object.keys(aliasConfigs);
    if (keys.length === 0) return null;

    // Resolve CSV references for counting with type conversion
    const resolvedConfigs: Record<string, any[]> = {};
    for (const key of keys) {
      resolvedConfigs[key] = resolveCsvReference(aliasConfigs[key], aliasTypes[key]);
    }

    const parts = keys.map(key => {
      const count = resolvedConfigs[key].length;
      const type = aliasTypes[key] || 'number';
      return `${key} (${type}): ${count} value${count !== 1 ? 's' : ''}`;
    });

    // Show different formula based on batch mode
    if (batchMode === 'zip') {
      // For zip mode, count is the length of first multi-value input
      const multiValueKeys = keys.filter(key => resolvedConfigs[key].length > 1);
      if (multiValueKeys.length === 0) {
        return `${parts.join('\n')}\n\n1 iteration (all single values)`;
      }
      const count = multiValueKeys.length > 0 ? resolvedConfigs[multiValueKeys[0]].length : 1;
      return `${parts.join('\n')}\n\nPaired by row: ${count} iterations`;
    } else {
      // Combination mode: show multiplication formula
      const formula = keys.map(key => resolvedConfigs[key].length).join(' x ');
      const total = keys.reduce((acc, key) => acc * resolvedConfigs[key].length, 1);
      return `${parts.join('\n')}\n\n${formula} = ${total} iterations`;
    }
  }, [aliasConfigs, aliasTypes, batchMode, resolveCsvReference]);

  const handleRun = () => {
    // Check if all aliases have configs or use default?
    // For now, only use configured ones.
    if (Object.keys(aliasConfigs).length === 0) return;

    // Convert aliasConfigs to MultiValueInput format for generateIterations
    // Resolve any CSV references to actual values with type conversion
    const multiValueInputs: MultiValueInput[] = Object.entries(aliasConfigs).map(([alias, values]) => ({
      alias,
      values: resolveCsvReference(values, aliasTypes[alias]),
    }));

    // Use generateIterations which respects batchMode (combination or zip)
    const combinations = generateIterations(multiValueInputs, batchMode);
    const inputs = combinations.map(combo => {
      // Add units to each input value
      const inputWithUnits: Record<string, any> = { path: filePath };
      for (const [key, value] of Object.entries(combo)) {
        if (aliasTypes[key] === 'string') {
          // String values: pass directly, no units wrapper
          inputWithUnits[key] = value;  // Already a string
        } else {
          // Numeric values: apply units if present
          const units = aliasUnits[key];
          if (units) {
            inputWithUnits[key] = { value, units };
          } else {
            inputWithUnits[key] = value;
          }
        }
      }
      return inputWithUnits;
    });

    prepareBatch({
      batch_id: `batch-${Date.now()}`,
      inputs,
      output_dir: getOutputDirPath(filePath),
      output_dir_mode: settings.outputDirMode,
      source_file_path: filePath || undefined,
      export_pdf: exportPdf,
      export_mcdx: exportMcdx,
      mode: batchMode,
      output_units: batchOutputUnits,
    });
  }

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      // Allow Shift+Enter shortcut from standard form controls used in batch/workflow setup.
      // Only block true multi-line or rich-text editing surfaces.
      if (target.isContentEditable) return true;
      if (tag === 'textarea') return true;
      const ariaMultiline = target.getAttribute('aria-multiline');
      return ariaMultiline === 'true';
    };

    const handleGlobalShortcut = (event: KeyboardEvent) => {
      const isEnterKey =
        event.key === 'Enter' ||
        event.code === 'Enter' ||
        event.code === 'NumpadEnter';
      if (!isEnterKey || !event.shiftKey || event.repeat) return;
      if (isEditableTarget(event.target)) return;

      if (activeTab === 'batch') {
        if (!filePath) {
          return;
        }
        event.preventDefault();
        handleRun();
        return;
      }

      if (activeTab === 'workflow') {
        if (workflowFiles.length === 0) {
          return;
        }
        event.preventDefault();
        setWorkflowRunShortcutSignal((current) => current + 1);
      }
    };

    // Capture phase avoids losing the shortcut when nested components stop propagation.
    document.addEventListener('keydown', handleGlobalShortcut, true);
    return () => document.removeEventListener('keydown', handleGlobalShortcut, true);
  }, [
    activeTab,
    filePath,
    handleRunWorkflow,
    workflowFiles.length,
    handleRun,
  ]);

  const handleResetBatch = useCallback(() => {
    setAliasConfigs({});
    clearCsvFiles();
    setResetConfirmOpen(false);
  }, []);

  return (
    <>
      {/* Phase 11.5: Recovery Modal - shown outside main layout for overlay */}
      {recoveryState && (
        <RecoveryModal
          state={recoveryState}
          onContinue={handleContinueRecovery}
          onDiscard={handleDiscardRecovery}
          open={!recoveryLoading && recoveryState !== null}
        />
      )}

      {/* Phase 12: Batch Preview Modal */}
      <BatchPreviewModal
        open={showPreview}
        onClose={cancelPreview}
        onRun={confirmBatch}
        mode={batchMode}
        inputs={Object.entries(aliasConfigs).map(([alias, values]) => ({
          alias,
          values: resolveCsvReference(values, aliasTypes[alias]),
        }))}
        isValid={(() => {
          const inputs: MultiValueInput[] = Object.entries(aliasConfigs).map(([alias, values]) => ({
            alias,
            values: resolveCsvReference(values, aliasTypes[alias]),
          }));
          return validateBatchMode(inputs).valid;
        })()}
        validationError={(() => {
          const inputs: MultiValueInput[] = Object.entries(aliasConfigs).map(([alias, values]) => ({
            alias,
            values: resolveCsvReference(values, aliasTypes[alias]),
          }));
          return validateBatchMode(inputs).error;
        })()}
        isStarting={isBatchStarting}
      />

      {/* Reset Batch Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)}>
        <DialogTitle>Reset All Inputs?</DialogTitle>
        <DialogContent>
          <Typography>
            This will clear all configured input values and uploaded CSV files.
            The current Mathcad file will remain selected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleResetBatch} color="primary" variant="contained">
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={workflowSchemaConfirmOpen}
        onClose={handleCancelWorkflowRunAfterSchemaUpdate}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{
          fontSize: '1.35rem',
          fontWeight: 700,
          pb: 0,
          pt: 3,
          px: 3,
        }}>
          Mathcad File Inputs/Outputs Updated
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2 }}>
          <Typography sx={{
            mb: 2.5,
            fontSize: '1rem',
            lineHeight: 1.6,
            color: tokens.neutral[600],
          }}>
            One or more workflow files changed since the last analyze. Removed mapped inputs will be ignored for this run if you continue.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {workflowSchemaChanges.map((change) => (
              <Box
                key={change.file_path}
                sx={{
                  border: `1px solid ${tokens.neutral[200]}`,
                  borderRadius: '20px',
                  px: 2.5,
                  py: 2,
                  backgroundColor: tokens.neutral[50],
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <Typography variant="subtitle1" sx={{
                  mb: 1,
                  fontWeight: 600,
                  fontSize: '1rem',
                }}>
                  {change.file_name}
                </Typography>
                {change.added_inputs.length > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.9rem', color: tokens.neutral[700], mb: 0.5 }}>
                    Added inputs: {change.added_inputs.join(', ')}
                  </Typography>
                )}
                {change.removed_inputs.length > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.9rem', color: tokens.neutral[700], mb: 0.5 }}>
                    Removed inputs: {change.removed_inputs.join(', ')}
                  </Typography>
                )}
                {change.added_outputs.length > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.9rem', color: tokens.neutral[700], mb: 0.5 }}>
                    Added outputs: {change.added_outputs.join(', ')}
                  </Typography>
                )}
                {change.removed_outputs.length > 0 && (
                  <Typography variant="body2" sx={{ fontSize: '0.9rem', color: tokens.neutral[700] }}>
                    Removed outputs: {change.removed_outputs.join(', ')}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1.5 }}>
          <Button
            onClick={handleCancelWorkflowRunAfterSchemaUpdate}
            size="large"
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
            }}
          >
            Cancel Run
          </Button>
          <Button
            onClick={handleConfirmWorkflowRunAfterSchemaUpdate}
            color="primary"
            variant="contained"
            size="large"
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
              },
            }}
          >
            Continue Run
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" elevation={1} sx={{
          backgroundColor: tokens.surface.paper,
          borderBottom: `1px solid ${tokens.neutral[200]}`,
          boxShadow: tokens.shadow.sm,
        }}>
          <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FileUploadIcon sx={{ color: tokens.primary[700], fontSize: 24 }} />
              <Typography variant="h6" sx={{
                color: tokens.neutral[800],
                fontWeight: 700,
                letterSpacing: '0.02em',
                fontFamily: 'Lexend, sans-serif'
              }}>
                MATHCAD AUTOMATOR
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Active batch/workflow indicator */}
              {currentBatchId && (
                <Badge color="primary" variant="standard">
                  BATCH ACTIVE
                </Badge>
              )}
              {activeWorkflowId && (
                <Badge color={isPaused ? 'warning' : 'primary'} variant="standard">
                  {isPaused ? 'WORKFLOW PAUSED' : 'WORKFLOW ACTIVE'}
                </Badge>
              )}

              {/* Settings button */}
              <Tooltip title={activeTab === 'workflow' ? "Workflow Settings" : "Global Settings"}>
                <IconButton
                  color="default"
                  size="large"
                  onClick={() => setSettingsOpened(true)}
                  aria-label="Settings"
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <Box component="main" id="main-content" sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Container maxWidth="xl">
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                mb: 2,
                '& .MuiTabs-flexContainer': {
                  backgroundColor: tokens.neutral[100],
                  padding: tokens.spacing[1],
                  borderRadius: tokens.radius.full,
                  gap: tokens.spacing[1],
                },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  color: tokens.neutral[500],
                  borderRadius: tokens.radius.full,
                  minHeight: '36px',
                  '&.Mui-selected': {
                    backgroundColor: tokens.primary[700],
                    color: tokens.neutral[0],
                  },
                },
                '& .MuiTabs-indicator': {
                  display: 'none',
                },
              }}
            >
              <Tab value="batch" icon={<ListAltIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Batch Processing" />
              <Tab value="workflow" icon={<MergeTypeIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Workflow" />
            </Tabs>
          </Container>

          {activeTab === 'batch' && (
            <Box
              sx={{
                minHeight: "calc(100vh - 120px)",
                backgroundColor: tokens.surface.canvas,
                py: 3,
              }}
            >
              <Container maxWidth="lg">
                <Stack spacing={2.5}>
                  {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: tokens.radius.lg }}>
                      {error}
                    </Alert>
                  )}

                  {warning && (
                    <Alert severity="warning" onClose={() => setWarning(null)} sx={{ borderRadius: tokens.radius.lg }}>
                      {warning}
                    </Alert>
                  )}

                  {/* File Target Bar - Compact card style */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: tokens.spacing[1],
                      padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                      background: tokens.surface.paper,
                      border: `1px solid ${tokens.neutral[100]}`,
                      borderRadius: tokens.radius.md,
                      boxShadow: tokens.shadow.sm,
                    }}
                  >
                    <FileIcon sx={{ color: tokens.primary[700], fontSize: 20 }} />
                    <Typography sx={{ flex: 1, fontWeight: 600, color: tokens.primary[700], fontSize: 14 }}>
                      {filePath ? filePath.split('\\').pop() : 'No file selected'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={async () => {
                        const result = await browseFile();
                        if (!result.cancelled && result.file_path) {
                          setFilePath(result.file_path);
                          // Auto-analyze after browse - pass path directly to avoid race condition
                          handleAnalyze(result.file_path);
                        }
                      }}
                      sx={{
                        fontSize: 14,
                        borderRadius: tokens.radius.sm,
                        borderColor: tokens.primary[200],
                        color: tokens.primary[700],
                        '&:hover': { borderColor: tokens.primary[700], background: tokens.primary[50] },
                      }}
                    >
                      Browse
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      component="label"
                      disabled={!filePath || aliases.length === 0}
                      sx={{
                        fontSize: 14,
                        borderRadius: tokens.radius.sm,
                        borderColor: tokens.primary[200],
                        color: tokens.primary[700],
                        '&:hover': { borderColor: tokens.primary[700], background: tokens.primary[50] },
                      }}
                    >
                      Load CSV
                      <input type="file" accept=".csv" hidden onChange={handleCsvUpload} />
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleAnalyze()}
                      disabled={isAnalyzing || !filePath}
                      startIcon={isAnalyzing ? <CircularProgress size={14} color="secondary" /> : undefined}
                      sx={{
                        fontSize: 14,
                        borderRadius: tokens.radius.sm,
                        background: tokens.primary[700],
                        boxShadow: tokens.shadow.md,
                        '&:hover': { background: tokens.primary[800] },
                        '&.Mui-disabled': { background: tokens.neutral[400] },
                      }}
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                    </Button>
                    <Tooltip title="Batch Settings">
                      <IconButton
                        onClick={() => setBatchSettingsOpen(true)}
                        size="small"
                        sx={{
                          color: tokens.neutral[500],
                          '&:hover': { color: tokens.primary[700], background: tokens.primary[50] },
                        }}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {aliases.length > 0 && (
                    <Stack spacing={2}>
                      {/* Batch Mode Selector */}
                      <BatchModeSelector
                        mode={batchMode}
                        onChange={setBatchMode}
                      />

                      {/* Parameter Cards - 2-column grid */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                          gap: 1.25,
                          maxHeight: 400,
                          overflow: 'auto',
                          pr: 1,
                        }}
                      >
                        {aliases.map((a) => {
                          // Check if this alias has a CSV reference
                          const configValue = aliasConfigs[a.alias];
                          const isCsvRef = typeof configValue === 'string' && configValue.startsWith('csv:');
                          let csvSourceInfo: { fileId: string; column: string; fileName?: string } | undefined;

                          if (isCsvRef) {
                            const parts = configValue.split(':');
                            if (parts.length >= 3) {
                              const fileId = parts[1];
                              const column = parts.slice(2).join(':');
                              const csvFile = csvFiles.find(f => f.id === fileId);
                              csvSourceInfo = { fileId, column, fileName: csvFile?.name };
                            }
                          }

                          // Get resolved values for display with type conversion
                          const displayValues = configValue ? resolveCsvReference(configValue, aliasTypes[a.alias]) : [];

                          return (
                            <InputPillCard
                              key={a.alias}
                              alias={a.alias}
                              displayName={a.name}
                              type={aliasTypes[a.alias] || 'number'}
                              values={displayValues}
                              units={aliasUnits[a.alias]}
                              unitOptions={UNIT_PRESETS.map(u => u.value).filter(v => v)}
                              csvSource={csvSourceInfo}
                              onChange={(vals) => {
                                setAliasConfigs(prev => ({ ...prev, [a.alias]: vals }));
                                setAliasTypes(prev => ({ ...prev, [a.alias]: typeof vals[0] === 'string' ? 'string' : 'number' }));
                              }}
                              onUnitChange={(unit) => setAliasUnits(prev => ({ ...prev, [a.alias]: unit }))}
                              onOpenConfig={() => handleConfigureAlias(a.alias)}
                              onCsvUnlink={() => {
                                // Clear CSV reference
                                setAliasConfigs(prev => {
                                  const newConfigs = { ...prev };
                                  delete newConfigs[a.alias];
                                  return newConfigs;
                                });
                              }}
                            />
                          );
                        })}
                      </Box>

                      {/* Output Units Section */}
                      {batchOutputs.length > 0 && (
                        <Stack spacing={1.25}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.neutral[600] }}>
                            Output Units
                          </Typography>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                              gap: 1.25,
                            }}
                          >
                            {batchOutputs.map((output) => (
                              <OutputPillCard
                                key={output.alias}
                                alias={output.alias}
                                displayName={output.name}
                                units={batchOutputUnits[output.alias]}
                                unitOptions={UNIT_PRESETS.map(u => u.value).filter(v => v)}
                                onUnitChange={(unit) => setBatchOutputUnits(prev => ({ ...prev, [output.alias]: unit }))}
                              />
                            ))}
                          </Box>
                        </Stack>
                      )}

                      {/* Iteration Footer */}
                      <Box
                        sx={{
                          mt: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                          borderRadius: tokens.radius.lg,
                          background: tokens.surface.paper,
                          border: `1px solid ${tokens.neutral[100]}`,
                          boxShadow: tokens.shadow.sm,
                        }}
                      >
                        {iterationBreakdown ? (
                          <Tooltip title={iterationBreakdown}>
                            <Stack direction="row" spacing={1} alignItems="baseline">
                              <Typography sx={{ fontSize: 22, fontWeight: 800, color: tokens.primary[700] }}>
                                {iterationCount}
                              </Typography>
                              <Typography sx={{ fontSize: 14, color: tokens.neutral[400] }}>
                                iterations
                              </Typography>
                            </Stack>
                          </Tooltip>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography sx={{ fontSize: 22, fontWeight: 800, color: tokens.primary[700] }}>
                              {iterationCount}
                            </Typography>
                            <Typography sx={{ fontSize: 14, color: tokens.neutral[400] }}>
                              iterations
                            </Typography>
                          </Stack>
                        )}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Tooltip title="Save configuration to library">
                            <IconButton
                              size="small"
                              onClick={() => setLibraryOpened(true)}
                              sx={{ color: tokens.primary[500], '&:hover': { color: tokens.primary[700], background: tokens.primary[50] } }}
                            >
                              <FolderIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Tooltip title="Export PDF">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={exportPdf}
                                    onChange={(e) => setExportPdf(e.target.checked)}
                                    size="small"
                                    sx={{ color: tokens.primary[500], '&.Mui-checked': { color: tokens.primary[700] } }}
                                  />
                                }
                                label={<Typography sx={{ fontSize: 14, color: tokens.neutral[400] }}>PDF</Typography>}
                              />
                            </Tooltip>
                            <Tooltip title="Export MCDX">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={exportMcdx}
                                    onChange={(e) => setExportMcdx(e.target.checked)}
                                    size="small"
                                    sx={{ color: tokens.primary[500], '&.Mui-checked': { color: tokens.primary[700] } }}
                                  />
                                }
                                label={<Typography sx={{ fontSize: 14, color: tokens.neutral[400] }}>MCDX</Typography>}
                              />
                            </Tooltip>
                            <Tooltip title="Overwrite existing files (uncheck to skip)">
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={overwriteExisting}
                                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                                    size="small"
                                    sx={{ color: tokens.primary[500], '&.Mui-checked': { color: tokens.primary[700] } }}
                                  />
                                }
                                label={<Typography sx={{ fontSize: 14, color: tokens.neutral[400] }}>Overwrite</Typography>}
                              />
                            </Tooltip>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Tooltip title="Reset all inputs to default values">
                              <IconButton
                                onClick={() => setResetConfirmOpen(true)}
                                disabled={batchData?.status === 'running'}
                                color="primary"
                                size="small"
                              >
                                <RefreshIcon />
                              </IconButton>
                            </Tooltip>
                            <Button
                              startIcon={<PlayArrowIcon />}
                              variant="contained"
                              disabled={iterationCount === 0}
                              onClick={handleRun}
                              sx={{
                                background: tokens.primary[700],
                                borderRadius: tokens.radius.full,
                                fontSize: 14,
                                fontWeight: 600,
                                boxShadow: tokens.shadow.md,
                                '&:hover': { background: tokens.primary[800] },
                                '&.Mui-disabled': { background: tokens.neutral[400] },
                              }}
                            >
                              Run
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>
                  )}

                  {batchData && (
                    <Stack spacing={2}>
                      <CompactStatusCard
                        progress={progress}
                        completed={batchData.completed}
                        total={batchData.total}
                        elapsed={0}
                        status={batchData.status as 'idle' | 'running' | 'completed' | 'stopped' | 'error'}
                        onStop={() => stopBatch(currentBatchId!)}
                        isStopping={isBatchStopping}
                      />
                      {/* Show BatchResultsList during execution and after completion for filename visibility */}
                      {(batchData?.status === 'running' || batchData?.status === 'completed') && (
                        <BatchResultsList
                          results={batchData?.results || []}
                          onViewPdf={(path) => openFile(path)}
                          onViewMcdx={(path) => openFile(path)}
                        />
                      )}
                      {/* Show BatchResultsTable after completion for detailed review and export */}
                      {batchData?.status === 'completed' && (
                        <BatchResultsTable
                          results={batchData?.results || []}
                          onViewPdf={(path) => openFile(path)}
                          onViewMcdx={(path) => openFile(path)}
                        />
                      )}
                    </Stack>
                  )}
                </Stack>
            </Container>
          </Box>
          )}

          {/* Phase 4.1: Batch Settings Drawer */}
          <BatchSettingsPanel
            open={batchSettingsOpen}
            onClose={() => setBatchSettingsOpen(false)}
            sourceFilePath={filePath}
          />

          {activeTab === 'workflow' && (
            <Container maxWidth={false} sx={{ p: 0 }}>
              {/* Phase 8.1: Three-panel layout for workflow */}
              {visibleWorkflowError && (
                <Container maxWidth="xl" sx={{ mt: 2 }}>
                  <Alert
                    severity="error"
                    onClose={() => {
                      setWorkflowError(null);
                      clearWorkflowRunError();
                    }}
                    sx={{ mb: 2 }}
                  >
                    {visibleWorkflowError}
                  </Alert>
                </Container>
              )}

              <Box sx={{ height: 'calc(100vh - 120px)', minHeight: '600px', position: 'relative' }}>
                {/* Phase 12.2: Simplified single-column layout for workflow */}
                <ErrorBoundary>
                  <Suspense fallback={<ViewLoader />}>
                    <WorkflowView
                    files={workflowFiles}
                    mappings={workflowMappings}
                    onFilesChange={setWorkflowFiles}
                    onMappingsChange={setWorkflowMappings}
                    onFileSelected={handleWorkflowFileSelected}
                    onAnalyzeAll={handleWorkflowAnalyzeAll}
                    onInputPillClick={(stepPosition, inputAlias) => {
                      const step = workflowFiles.find(f => f.position === stepPosition);
                      if (!step) return;
                      const metadata = filesMetadata[step.file_path];
                      if (!metadata) return;
                      const inputMeta = metadata.inputs.find(i => i.alias === inputAlias);
                      if (!inputMeta) return;
                      const stringIndicators = ['string', 'text', 'name', 'label', 'path', 'file', 'dir', 'url'];
                      const inputType = stringIndicators.some(s => inputMeta.name.toLowerCase().includes(s)) ? 'string' as const : 'numeric' as const;
                      setSelectedPill({ stepPosition, inputAlias, inputName: inputMeta.name, inputType });
                    }}
                    selectedPill={panelState.selectedPill}
                    stepResults={stepResults}
                    filesMetadata={filesMetadata}
                    onRunWorkflow={handleRunWorkflow}
                    runShortcutSignal={workflowRunShortcutSignal}
                    isRunning={isWorkflowRunning}
                    onOpenSettings={() => setSettingsOpened(true)}
                    workflowStatus={workflowData}
                    workflowProgress={workflowProgress}
                    failureMode={failureMode}
                    onFailureModeChange={setFailureMode}
                    pauseMode={pauseMode}
                    onPauseModeChange={setPauseMode}
                    workflowIterationMode={workflowIterationMode}
                    onWorkflowIterationModeChange={setWorkflowIterationMode}
                    exportPdf={exportPdf}
                    exportMcdx={exportMcdx}
                    onExportPdfChange={setExportPdf}
                    onExportMcdxChange={setExportMcdx}
                    warnings={workflowSummaryData.warnings}
                    totalIterations={workflowSummaryData.totalIterations}
                    onStopWorkflow={stopWorkflow}
                    isStopping={isStopping}
                  />
                  </Suspense>
                </ErrorBoundary>
              </Box>
            </Container>
          )}

        </Box>
      </Box>

      {/* Floating save button */}
      <Tooltip title="Quick Save Configuration">
        <Fab
          color="primary"
          aria-label="Quick save current configuration"
          onClick={() => {
            if (activeTab === 'batch' && filePath) {
              setLibraryOpened(true);
            } else if (activeTab === 'workflow' && workflowFiles.length > 0) {
              setSettingsOpened(true);
            }
          }}
          sx={{
            position: 'fixed',
            bottom: 30,
            right: 30,
            backgroundColor: tokens.primary[700],
            boxShadow: tokens.shadow.md,
            '&:hover': {
              backgroundColor: tokens.primary[800],
            },
          }}
        >
          <SaveIcon />
        </Fab>
      </Tooltip>

      {/* Settings drawer */}
      <Drawer
        anchor="right"
        open={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        PaperProps={{ sx: { width: 320 } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            {isWorkflowSettings ? 'Workflow Settings' : 'Batch Settings'}
          </Typography>
          <Stack spacing={3}>
            <Typography variant="subtitle2">Export Defaults</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settingsExportPdf}
                  onChange={(e) => {
                    setExportPdf(e.target.checked);
                  }}
                />
              }
              label="Export PDF by default"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settingsExportMcdx}
                  onChange={(e) => {
                    setExportMcdx(e.target.checked);
                  }}
                />
              }
              label="Export MCDX by default"
            />
            <Typography variant="subtitle2">About</Typography>
            <Typography variant="body2" color="text.secondary">
              Mathcad Automator v1.0.0
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Batch processing and workflow orchestration for Mathcad Prime.
            </Typography>
          </Stack>
        </Box>
      </Drawer>

      {/* Modals */}
      <InputModal
        opened={opened}
        onClose={() => setOpened(false)}
        alias={selectedAlias || ''}
        onSave={(values) => {
          if (selectedAlias) {
            handleSaveAliasConfig(selectedAlias, values);
          }
        }}
        csvColumnsGrouped={getCsvColumnsGrouped()}
        onCsvColumnSelect={(fileId, column) => {
          // Track reference when user selects a CSV column
          // For batch tab, we use stepPosition -1 to indicate batch context
          if (selectedAlias) {
            addCsvReference(fileId, column, -1, selectedAlias);
          }
        }}
      />

      <LibraryModal
        opened={libraryOpened}
        onClose={() => setLibraryOpened(false)}
        filePath={filePath}
        currentInputs={aliasConfigs as Record<string, any[]>}
        currentUnits={aliasUnits}
        exportPdf={exportPdf}
        exportMcdx={exportMcdx}
        outputDir={undefined}
        onLoadConfig={handleLoadLibraryConfig}
      />

    </>
  )
}

export default App

