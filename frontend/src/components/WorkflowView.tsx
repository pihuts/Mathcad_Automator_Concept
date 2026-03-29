import {
  Stack,
  Box,
  Typography,
  Button,
  ButtonBase,
  Tooltip,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Search as SearchIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  browseFile,
  type WorkflowFile,
  type FileMapping,
  type StepResult,
  type MetaData,
  type InputConfig,
  type WorkflowStatusResponse,
  WorkflowStatus,
} from '../services/api';
import { WorkflowStepCard } from './WorkflowStepCard';
import { WorkflowResultView } from './workflow/WorkflowResultView';
import { InputModal } from './InputModal';
import { MappingConfigModal } from './MappingConfigModal';
import type { CsvSource } from './InputPillCard';
import { tokens } from '../theme/mui-theme';
import { buildAutoMappings } from '../utils/workflowAutoMapping';

interface WorkflowViewProps {
  files: WorkflowFile[];
  mappings: FileMapping[];
  onFilesChange: (files: WorkflowFile[]) => void;
  onMappingsChange: (mappings: FileMapping[]) => void;
  onInputPillClick: (stepPosition: number, inputAlias: string) => void;
  selectedPill?: { stepPosition: number; inputAlias: string } | null;
  onFileSelected?: (filePath: string) => void;
  onAnalyzeAll?: (filePaths: string[]) => Promise<void>;
  stepResults?: StepResult[];
  filesMetadata?: Record<string, MetaData>;
  onRunWorkflow: () => void;
  runShortcutSignal?: number;
  isRunning: boolean;
  onOpenSettings: () => void;
  workflowStatus?: WorkflowStatusResponse | null;
  workflowProgress?: number;
  failureMode: string;
  onFailureModeChange: (mode: string) => void;
  pauseMode: string;
  onPauseModeChange: (mode: string) => void;
  workflowIterationMode: 'combination' | 'zip';
  onWorkflowIterationModeChange: (mode: 'combination' | 'zip') => void;
  exportPdf: boolean;
  exportMcdx: boolean;
  onExportPdfChange: (value: boolean) => void;
  onExportMcdxChange: (value: boolean) => void;
  warnings: string[];
  totalIterations: number;
  onPauseWorkflow?: () => void;
  onResumeWorkflow?: () => void;
  onStopWorkflow?: () => void;
  onResumeFromCheckpoint?: () => void;
  isPausing?: boolean;
  isResuming?: boolean;
  isStopping?: boolean;
  /** Grouped CSV columns from global state */
  csvColumnsGrouped?: Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  /** Callback when CSV column is selected */
  onCsvColumnSelect?: (fileId: string, column: string) => void;
}

/**
 * WorkflowView: Simplified single-column layout for workflow configuration.
 * Uses WorkflowStepCard components with InputPillCard for inputs.
 * Toolbar at top, FAB for running workflow at bottom-right.
 */
export const WorkflowView = ({
  files,
  mappings,
  onFilesChange,
  onMappingsChange,
  onInputPillClick: _onInputPillClick,
  selectedPill,
  onFileSelected,
  onAnalyzeAll,
  stepResults,
  filesMetadata = {},
  onRunWorkflow,
  runShortcutSignal = 0,
  isRunning,
  onOpenSettings,
  workflowStatus,
  workflowProgress = 0,
  failureMode: _failureMode,
  onFailureModeChange: _onFailureModeChange,
  pauseMode: _pauseMode,
  onPauseModeChange: _onPauseModeChange,
  exportPdf: _exportPdf,
  exportMcdx: _exportMcdx,
  onExportPdfChange: _onExportPdfChange,
  onExportMcdxChange: _onExportMcdxChange,
  warnings,
  totalIterations: _totalIterations,
  onPauseWorkflow,
  onResumeWorkflow,
  onStopWorkflow,
  onResumeFromCheckpoint,
  isPausing = false,
  isResuming = false,
  isStopping = false,
  csvColumnsGrouped = [],
  onCsvColumnSelect,
}: WorkflowViewProps) => {
  type UnifiedStep =
    | { type: 'calculation'; data: WorkflowFile; arrayIndex: number };
  type NavigatorStep = UnifiedStep | { type: 'result' };

  const getDisplayName = (filePath?: string) => {
    if (!filePath) return 'No file selected';
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || filePath;
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Output units state - maps "filePath|alias" to unit string
  const [outputUnits, setOutputUnits] = useState<Record<string, string>>({});

  // InputModal state
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [selectedInput, setSelectedInput] = useState<{
    filePath: string;
    alias: string;
    inputName: string;
  } | null>(null);


  // MappingConfigModal state
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [selectedMappingInput, setSelectedMappingInput] = useState<{
    filePath: string;
    alias: string;
    inputName: string;
  } | null>(null);
  const [autoMappedTargets, setAutoMappedTargets] = useState<Set<string>>(new Set());
  const [autoMappingDisabledTargets, setAutoMappingDisabledTargets] = useState<Set<string>>(new Set());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const lastShortcutSignalRef = useRef(runShortcutSignal);
  const dockItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const toTargetKey = (filePath: string, alias: string): string => `${filePath}|${alias}`;

  const areMappingsEqual = (left: FileMapping[], right: FileMapping[]): boolean => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      const a = left[i];
      const b = right[i];
      if (
        a.source_file !== b.source_file ||
        a.source_alias !== b.source_alias ||
        a.source_type !== b.source_type ||
        a.target_file !== b.target_file ||
        a.target_alias !== b.target_alias ||
        a.units !== b.units
      ) {
        return false;
      }
    }
    return true;
  };

  const areTargetSetsEqual = (left: Set<string>, right: Set<string>): boolean => {
    if (left.size !== right.size) return false;
    for (const key of left) {
      if (!right.has(key)) return false;
    }
    return true;
  };

  const markManualOverride = (filePath: string, alias: string) => {
    const key = toTargetKey(filePath, alias);
    setAutoMappingDisabledTargets((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setAutoMappedTargets((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const reenableAutoMapping = (filePath: string, alias: string) => {
    const key = toTargetKey(filePath, alias);
    setAutoMappingDisabledTargets((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Build unified step sequence for display
  const normalizeUnifiedSteps = (
    calculationSteps: WorkflowFile[]
  ): UnifiedStep[] => {
    const steps: UnifiedStep[] = [];
    calculationSteps.forEach((f, idx) => steps.push({ type: 'calculation', data: f, arrayIndex: idx }));

    const sorted = steps.sort((a, b) => {
      const posA = Number.isFinite(a.data.position) ? a.data.position : Number.MAX_SAFE_INTEGER;
      const posB = Number.isFinite(b.data.position) ? b.data.position : Number.MAX_SAFE_INTEGER;

      if (posA !== posB) {
        return posA - posB;
      }

      return a.arrayIndex - b.arrayIndex;
    });

    return sorted.map((step, idx) => (
      { ...step, data: { ...step.data, position: idx } }
    ));
  };

  const applyUnifiedSteps = (steps: UnifiedStep[]) => {
    const updatedFiles: WorkflowFile[] = [];

    steps.forEach((item, idx) => {
      if (item.type === 'calculation') {
        updatedFiles.push({ ...item.data, position: idx });
      }
    });

    onFilesChange(updatedFiles);
  };

  const unifiedSteps = useMemo(() => {
    return normalizeUnifiedSteps(files);
  }, [files]);
  const orderedFiles = useMemo(() => {
    return unifiedSteps.map((step) => step.data);
  }, [unifiedSteps]);
  const navigatorSteps = useMemo<NavigatorStep[]>(() => {
    if (unifiedSteps.length === 0) {
      return [];
    }
    return [...unifiedSteps, { type: 'result' }];
  }, [unifiedSteps]);
  const resultStepIndex = navigatorSteps.length > 0 ? navigatorSteps.length - 1 : null;

  const activeFileName = useMemo(() => {
    if (!workflowStatus || workflowStatus.total_files <= 0) {
      return null;
    }

    const activeIndex = Math.max(0, Math.min(workflowStatus.current_file_index, files.length - 1));
    const activeFile = files[activeIndex];
    return activeFile?.file_path ? getDisplayName(activeFile.file_path) : null;
  }, [files, workflowStatus]);

  const completedCount = useMemo(() => {
    if (workflowStatus?.completed_files?.length) {
      return workflowStatus.completed_files.length;
    }

    return stepResults?.filter((result) => result.status === 'completed').length ?? 0;
  }, [stepResults, workflowStatus]);

  const currentExecutionLabel = useMemo(() => {
    const runningStep = stepResults?.find((result) => result.status === 'running');
    if (runningStep?.file_path) {
      return getDisplayName(runningStep.file_path);
    }

    if (workflowStatus?.status === WorkflowStatus.PAUSED && workflowStatus.paused_at_step !== null && workflowStatus.paused_at_step !== undefined) {
      const pausedStep = unifiedSteps[workflowStatus.paused_at_step];
      if (pausedStep?.type === 'calculation') {
        return getDisplayName(pausedStep.data.file_path);
      }
    }

    if (workflowStatus?.completed_files?.length) {
      return getDisplayName(workflowStatus.completed_files[workflowStatus.completed_files.length - 1]);
    }

    return activeFileName;
  }, [activeFileName, getDisplayName, stepResults, unifiedSteps, workflowStatus]);

  const executionStepIndex = useMemo(() => {
    const canShowExecutionState =
      workflowStatus?.status === WorkflowStatus.RUNNING ||
      workflowStatus?.status === WorkflowStatus.PAUSED;

    if (!canShowExecutionState) {
      return null;
    }

    const runningStep = stepResults?.find((result) => result.status === 'running');
    if (runningStep?.file_path) {
      const index = unifiedSteps.findIndex(
        (step) => step.type === 'calculation' && step.data.file_path === runningStep.file_path
      );
      return index >= 0 ? index : null;
    }

    if (
      workflowStatus?.status === WorkflowStatus.PAUSED &&
      workflowStatus.paused_at_step !== null &&
      workflowStatus.paused_at_step !== undefined &&
      workflowStatus.paused_at_step >= 0 &&
      workflowStatus.paused_at_step < unifiedSteps.length
    ) {
      return workflowStatus.paused_at_step;
    }

    return null;
  }, [stepResults, unifiedSteps, workflowStatus]);

  useEffect(() => {
    if (navigatorSteps.length === 0) {
      setActiveStepIndex(0);
      return;
    }

    if (selectedPill?.stepPosition !== null && selectedPill?.stepPosition !== undefined) {
      setActiveStepIndex(Math.max(0, Math.min(selectedPill.stepPosition, navigatorSteps.length - 1)));
      return;
    }

    setActiveStepIndex((current) => Math.max(0, Math.min(current, navigatorSteps.length - 1)));
  }, [navigatorSteps.length, selectedPill]);

  useEffect(() => {
    if (navigatorSteps.length <= 1) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (inputModalOpen || mappingModalOpen || event.defaultPrevented) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const role = target?.getAttribute('role');
      const tagName = target?.tagName;
      const isEditable =
        !!target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        role === 'textbox' ||
        role === 'combobox' ||
        role === 'spinbutton';

      if (isEditable) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveStepIndex((current) => Math.min(current + 1, navigatorSteps.length - 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputModalOpen, mappingModalOpen, navigatorSteps.length]);

  useEffect(() => {
    const target = dockItemRefs.current[activeStepIndex];
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeStepIndex]);

  const handleAnalyzeAll = async () => {
    const validFilePaths = files.filter((f) => f.file_path).map((f) => f.file_path);

    if (validFilePaths.length === 0) {
      setAnalyzeError('No files to analyze. Please add workflow files first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      if (onAnalyzeAll) {
        await onAnalyzeAll(validFilePaths);
      }
    } catch (error: unknown) {
      console.error('Failed to analyze workflow files:', error);
      setAnalyzeError((error as Error)?.message || 'Failed to analyze workflow files');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddFile = async () => {
    const result = await browseFile();
    if (!result.cancelled && result.file_path) {
      const newFile: WorkflowFile = {
        file_path: result.file_path,
        inputs: [],
        position: unifiedSteps.length,
      };
      setActiveStepIndex(unifiedSteps.length);
      onFilesChange([...files, newFile]);
      if (onFileSelected) {
        onFileSelected(result.file_path);
      }
    }
  };

  const handleRemoveFile = (filePath: string) => {
    const removedIndex = unifiedSteps.findIndex((step) => step.type === 'calculation' && step.data.file_path === filePath);
    const newFiles = files.filter((f) => f.file_path !== filePath);
    if (removedIndex >= 0) {
      setActiveStepIndex((current) => Math.max(0, Math.min(current > removedIndex ? current - 1 : current, unifiedSteps.length - 2)));
    }

    applyUnifiedSteps(normalizeUnifiedSteps(newFiles));

    const newMappings = mappings.filter(
      (m) => m.source_file !== filePath && m.target_file !== filePath
    );
    onMappingsChange(newMappings);
  };

  const handleMoveStep = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= unifiedSteps.length) return;

    const newUnifiedSteps = [...unifiedSteps];
    const [moved] = newUnifiedSteps.splice(currentIndex, 1);
    newUnifiedSteps.splice(targetIndex, 0, moved);
    setActiveStepIndex((current) => {
      if (current === currentIndex) return targetIndex;
      if (current === targetIndex) return currentIndex;
      return current;
    });

    applyUnifiedSteps(newUnifiedSteps);
  };

  useEffect(() => {
    if (orderedFiles.length === 0) return;

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: mappings,
      autoTargets: autoMappedTargets,
      disabledTargets: autoMappingDisabledTargets,
    });

    const mappingsChanged = !areMappingsEqual(mappings, nextMappings);
    const autoTargetsChanged = !areTargetSetsEqual(autoMappedTargets, nextAutoTargets);

    if (mappingsChanged) {
      onMappingsChange(nextMappings);
    }
    if (autoTargetsChanged) {
      setAutoMappedTargets(nextAutoTargets);
    }
  }, [
    orderedFiles,
    filesMetadata,
    mappings,
    autoMappedTargets,
    autoMappingDisabledTargets,
    onMappingsChange,
  ]);

  // ============ Input Value/Unit/CSV Source Helpers ============

  const getInputValues = (filePath: string, alias: string): (string | number)[] => {
    const file = files.find((f) => f.file_path === filePath);
    if (!file) return [];

    const inputConfig = file.inputs?.find((ic) => ic.alias === alias);
    if (!inputConfig) return [];

    // Handle CSV source - return empty array (CSV values loaded at execution)
    if (inputConfig.csvSource) {
      return [];
    }

    const value = inputConfig.value;
    if (Array.isArray(value)) {
      return value;
    }
    if (value !== undefined && value !== null && value !== '') {
      return [value as string | number];
    }
    return [];
  };

  const getInputUnits = (filePath: string, alias: string): string | undefined => {
    const mapping = mappings.find((m) => m.target_file === filePath && m.target_alias === alias);
    if (mapping) {
      return mapping.units;
    }

    const file = files.find((f) => f.file_path === filePath);
    if (!file) return undefined;

    const inputConfig = file.inputs?.find((ic) => ic.alias === alias);
    return inputConfig?.units;
  };

  const getInputCsvSource = (filePath: string, alias: string): CsvSource | undefined => {
    const file = files.find((f) => f.file_path === filePath);
    if (!file) return undefined;

    const inputConfig = file.inputs?.find((ic) => ic.alias === alias);
    if (!inputConfig?.csvSource) return undefined;

    return {
      fileId: inputConfig.csvSource.fileId,
      column: inputConfig.csvSource.column,
    };
  };

  const getMappingCount = (filePath: string): number => {
    return mappings.filter((m) => m.target_file === filePath).length;
  };

  // ============ Output Unit Helpers ============

  const getOutputUnits = (filePath: string, alias: string): string | undefined => {
    const key = `${filePath}|${alias}`;
    return outputUnits[key];
  };

  const handleOutputUnitChange = (filePath: string, alias: string, unit: string) => {
    const key = `${filePath}|${alias}`;
    setOutputUnits(prev => ({ ...prev, [key]: unit }));

    // Update files prop so output_units is persisted and sent to backend
    const updatedFiles = files.map((f) => {
      if (f.file_path !== filePath) return f;

      const currentOutputUnits = f.output_units || {};
      if (unit === '') {
        // Remove unit setting
        const { [alias]: _, ...rest } = currentOutputUnits;
        return { ...f, output_units: rest };
      } else {
        return { ...f, output_units: { ...currentOutputUnits, [alias]: unit } };
      }
    });
    onFilesChange(updatedFiles);
  };

  const isInputMapped = (filePath: string, alias: string): boolean => {
    return mappings.some(m => m.target_file === filePath && m.target_alias === alias);
  };

  const isInputAutoMapped = (filePath: string, alias: string): boolean => {
    return autoMappedTargets.has(toTargetKey(filePath, alias));
  };

  const getMappedSource = (filePath: string, alias: string): { stepIndex: number; stepLabel: string; outputAlias: string } | undefined => {
    const mapping = mappings.find(m => m.target_file === filePath && m.target_alias === alias);
    if (!mapping) return undefined;

    // Find source step index in unified steps
    const sourceStepIndex = unifiedSteps.findIndex(
      s => s.type === 'calculation' && s.data.file_path === mapping.source_file
    );
    return {
      stepIndex: sourceStepIndex + 1, // 1-based for display
      stepLabel: mapping.source_file.split('\\').pop() || '',
      outputAlias: mapping.source_alias,
    };
  };

  const handleConfigureMapping = (filePath: string, alias: string, inputName: string) => {
    setSelectedMappingInput({ filePath, alias, inputName });
    setMappingModalOpen(true);
  };

  const handleUnlockInput = (filePath: string, alias: string) => {
    markManualOverride(filePath, alias);
    // Remove the mapping for this input
    const filteredMappings = mappings.filter(
      m => !(m.target_file === filePath && m.target_alias === alias)
    );
    onMappingsChange(filteredMappings);

    // Restore the input's value by clearing any null value set when mapping was created
    const updatedFiles = files.map(f => {
      if (f.file_path !== filePath) return f;
      return {
        ...f,
        inputs: f.inputs.map(inp => {
          if (inp.alias !== alias) return inp;
          // Clear value to restore normal input state
          return { ...inp, value: null };
        })
      };
    });
    onFilesChange(updatedFiles);
  };


  const getUpstreamOutputs = (filePath: string): Array<{ value: string; label: string; group: string }> => {
    const currentIndex = files.findIndex(f => f.file_path === filePath);
    // Get all inputs and outputs from previous steps (position < target position)
    return files.slice(0, currentIndex).flatMap((f, idx) => {
      const stepName = `Step ${idx + 1}: ${getDisplayName(f.file_path)}`;
      const items: Array<{ value: string; label: string; group: string }> = [];

      // Add inputs from this step
      if (f.inputs) {
        f.inputs.forEach(inp => {
          items.push({
            value: `${f.file_path}|${inp.alias}|input`,
            label: `${inp.alias} (input)`,
            group: stepName,
          });
        });
      }

      // Add outputs from this step
      const metadata = filesMetadata[f.file_path];
      if (metadata?.outputs) {
        metadata.outputs.forEach(out => {
          items.push({
            value: `${f.file_path}|${out.alias}|output`,
            label: `${out.alias} (output)`,
            group: stepName,
          });
        });
      }

      return items;
    });
  };

  const getStepResult = (filePath: string): StepResult | undefined => {
    return stepResults?.find((sr) => sr.file_path === filePath);
  };

  const getStepSaveMode = (file: WorkflowFile, format: 'pdf' | 'mcdx'): 'inherit' | 'global' | 'on' | 'off' => {
    const value = format === 'pdf' ? file.save_pdf : file.save_mcdx;
    if (value === true) return 'on';
    if (value === false) return 'off';
    if (value === null) return 'global';
    return 'inherit';
  };

  const handleStepSaveModeChange = (
    filePath: string,
    format: 'pdf' | 'mcdx',
    mode: 'inherit' | 'global' | 'on' | 'off'
  ) => {
    const updatedFiles = files.map((file) => {
      if (file.file_path !== filePath) {
        return file;
      }

      const value: boolean | null | undefined =
        mode === 'on' ? true :
        mode === 'off' ? false :
        mode === 'global' ? null :
        undefined;

      return format === 'pdf'
        ? { ...file, save_pdf: value }
        : { ...file, save_mcdx: value };
    });

    onFilesChange(updatedFiles);
  };

  const getStepIterationMode = (file: WorkflowFile): 'combination' | 'zip' => {
    return file.mode === 'zip' ? 'zip' : 'combination';
  };

  const hasManualOverrideValue = (value: unknown): boolean => {
    if (Array.isArray(value)) {
      return value.some((item) => item !== null && item !== undefined && String(item).trim() !== '');
    }
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  };

  const handleStepIterationModeChange = (filePath: string, mode: 'combination' | 'zip') => {
    const updatedFiles = files.map((file) => (
      file.file_path === filePath ? { ...file, mode } : file
    ));
    onFilesChange(updatedFiles);
  };

  // ============ Input Change Handlers ============

  const handleInputValueChange = (filePath: string, alias: string, values: any[]) => {
    const isManualOverride = hasManualOverrideValue(values);
    const existingMapping = mappings.find(
      (m) => m.target_file === filePath && m.target_alias === alias
    );
    const updatedFiles = files.map((f) => {
      if (f.file_path !== filePath) return f;

      const existingInputs = f.inputs || [];
      const inputIndex = existingInputs.findIndex((i) => i.alias === alias);

      if (inputIndex >= 0) {
        const newInputs = [...existingInputs];
        newInputs[inputIndex] = { ...newInputs[inputIndex], value: values };
        return { ...f, inputs: newInputs };
      } else {
        // Create new input config
        const newInput: InputConfig = {
          alias,
          value: values,
          inputType: 'number',
        };
        return { ...f, inputs: [...existingInputs, newInput] };
      }
    });

    const previousInput = files
      .find((f) => f.file_path === filePath)
      ?.inputs?.find((i) => i.alias === alias);
    const previousValue = previousInput?.value;
    const valueChanged = JSON.stringify(previousValue) !== JSON.stringify(values);

    if (isManualOverride && existingMapping && valueChanged) {
      markManualOverride(filePath, alias);
      const filteredMappings = mappings.filter(
        (m) => !(m.target_file === filePath && m.target_alias === alias)
      );
      if (filteredMappings.length !== mappings.length) {
        onMappingsChange(filteredMappings);
      }
    }

    onFilesChange(updatedFiles);
  };

  const handleInputUnitChange = (filePath: string, alias: string, unit: string) => {
    const mappingIndex = mappings.findIndex(
      (m) => m.target_file === filePath && m.target_alias === alias
    );

    // For mapped inputs, units override lives on the mapping itself.
    if (mappingIndex >= 0) {
      const updatedMappings = [...mappings];
      updatedMappings[mappingIndex] = {
        ...updatedMappings[mappingIndex],
        units: unit || undefined,
      };
      onMappingsChange(updatedMappings);
      return;
    }

    const updatedFiles = files.map((f) => {
      if (f.file_path !== filePath) return f;

      const existingInputs = f.inputs || [];
      const inputIndex = existingInputs.findIndex((i) => i.alias === alias);

      if (inputIndex >= 0) {
        const newInputs = [...existingInputs];
        newInputs[inputIndex] = { ...newInputs[inputIndex], units: unit };
        return { ...f, inputs: newInputs };
      } else {
        // Create new input config with units
        const newInput: InputConfig = {
          alias,
          value: [],
          units: unit,
          inputType: 'number',
        };
        return { ...f, inputs: [...existingInputs, newInput] };
      }
    });

    onFilesChange(updatedFiles);
  };

  const handleOpenInputModal = (filePath: string, alias: string, _inputName: string) => {
    setSelectedInput({ filePath, alias, inputName: _inputName });
    setInputModalOpen(true);
  };

  const handleCsvUnlink = (filePath: string, alias: string) => {
    const updatedFiles = files.map((f) => {
      if (f.file_path !== filePath) return f;

      const existingInputs = f.inputs || [];
      const inputIndex = existingInputs.findIndex((i) => i.alias === alias);

      if (inputIndex >= 0) {
        const newInputs = [...existingInputs];
        // Remove CSV source and clear value
        const { csvSource, ...rest } = newInputs[inputIndex];
        newInputs[inputIndex] = { ...rest, value: [] };
        return { ...f, inputs: newInputs };
      }

      return f;
    });

    onFilesChange(updatedFiles);
  };

  const handleInputConfigSave = (config: InputConfig) => {
    if (!selectedInput) return;
    const isManualOverride = hasManualOverrideValue(config.value);
    const existingMapping = mappings.find(
      (m) => m.target_file === selectedInput.filePath && m.target_alias === selectedInput.alias
    );

    const updatedFiles = files.map((f) => {
      if (f.file_path !== selectedInput.filePath) return f;

      const existingInputs = f.inputs || [];
      const inputIndex = existingInputs.findIndex((i) => i.alias === config.alias);

      if (inputIndex >= 0) {
        const newInputs = [...existingInputs];
        newInputs[inputIndex] = config;
        return { ...f, inputs: newInputs };
      } else {
        return { ...f, inputs: [...existingInputs, config] };
      }
    });

    const previousInput = files
      .find((f) => f.file_path === selectedInput.filePath)
      ?.inputs?.find((i) => i.alias === selectedInput.alias);
    const previousValue = previousInput?.value;
    const valueChanged = JSON.stringify(previousValue) !== JSON.stringify(config.value);

    if (isManualOverride && existingMapping && valueChanged) {
      markManualOverride(selectedInput.filePath, selectedInput.alias);
      const filteredMappings = mappings.filter(
        (m) => !(m.target_file === selectedInput.filePath && m.target_alias === selectedInput.alias)
      );
      if (filteredMappings.length !== mappings.length) {
        onMappingsChange(filteredMappings);
      }
    }

    onFilesChange(updatedFiles);
    setInputModalOpen(false);
  };

  const handleInputModalCsvSelect = (fileId: string, column: string) => {
    onCsvColumnSelect?.(fileId, column);
  };

  const createdFiles = workflowStatus?.created_files ?? [];
  const resultSummary = workflowStatus?.result_summary ?? null;
  const isEmptyResultState = !workflowStatus?.status && createdFiles.length === 0;

  const getNavigatorLabel = (step: NavigatorStep, _index: number) => {
    if (step.type === 'result') {
      return 'Result';
    }

    return getDisplayName(step.data.file_path);
  };

  const getNavigatorState = (step: NavigatorStep, index: number) => {
    const isWorkflowExecuting =
      workflowStatus?.status === WorkflowStatus.RUNNING ||
      workflowStatus?.status === WorkflowStatus.PAUSED;

    if (step.type === 'result') {
      if (workflowStatus?.status === WorkflowStatus.FAILED) return 'error';
      if (isWorkflowExecuting) return 'idle';
      if (workflowStatus?.status) return 'complete';
      return createdFiles.length > 0 ? 'complete' : 'idle';
    }
    if (isWorkflowExecuting) {
      if (executionStepIndex === index) {
        return 'idle';
      }

      if (step.type === 'calculation') {
        const status = stepResults?.find((result) => result.file_path === step.data.file_path)?.status;
        if (status === 'failed') return 'error';
      }

      return 'idle';
    }

    if (step.type === 'calculation') {
      const status = stepResults?.find((result) => result.file_path === step.data.file_path)?.status;
      if (status === 'failed') return 'error';
      if (status === 'completed') return 'complete';

      if (workflowStatus?.completed_files?.includes(step.data.file_path)) {
        return 'complete';
      }
    }

    return 'idle';
  };

  const getNavigatorPalette = (
    _step: NavigatorStep,
    state: 'idle' | 'complete' | 'active' | 'error',
    isSelected: boolean
  ) => {
    if (state === 'error') {
      return {
        border: tokens.error.border,
        background: tokens.error.light,
        text: tokens.error.dark,
        connector: tokens.error.border,
        shadow: 'none',
      };
    }

    return state === 'complete'
      ? {
          border: jade.strong,
          background: jade.strong,
          text: tokens.neutral[0],
          connector: jade.medium,
          shadow: isSelected ? `0 8px 20px ${tokens.alpha.primary[20]}` : 'none',
        }
      : {
          border: jade.soft,
          background: tokens.neutral[0],
          text: jade.ink,
          connector: jade.muted,
          shadow: isSelected ? `0 8px 20px ${tokens.alpha.neutral[12]}` : 'none',
        };
  };

  const goToStep = (index: number) => {
    if (navigatorSteps.length === 0) {
      return;
    }

    setActiveStepIndex(Math.max(0, Math.min(index, navigatorSteps.length - 1)));
  };

  const handleRunWorkflowClick = () => {
    if (resultStepIndex !== null) {
      setActiveStepIndex(resultStepIndex);
    }
    onRunWorkflow();
  };

  useEffect(() => {
    if (runShortcutSignal <= lastShortcutSignalRef.current) {
      return;
    }

    lastShortcutSignalRef.current = runShortcutSignal;
    handleRunWorkflowClick();
  }, [runShortcutSignal, handleRunWorkflowClick]);

  const activeStep = navigatorSteps[activeStepIndex];
  const activeCalculationFile = activeStep?.type === 'calculation' ? activeStep.data : null;
  const activeResultStep = activeStep?.type === 'result';
  const activeStepLabel = activeStep ? getNavigatorLabel(activeStep, activeStepIndex) : null;
  const canGoPrevious = activeStepIndex > 0;
  const canGoNext = activeStepIndex < navigatorSteps.length - 1;
  const jade = {
    strong: tokens.primary[700],
    medium: tokens.primary[600],
    soft: tokens.primary[100],
    muted: tokens.neutral[300],
    surface: tokens.neutral[50],
    ink: tokens.neutral[900],
  };

  return (
    <Box sx={{
      position: 'relative',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: tokens.neutral[0],
    }}>
      {analyzeError && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert
            severity="error"
            onClose={() => setAnalyzeError(null)}
            sx={{ borderRadius: '12px' }}
          >
            {analyzeError}
          </Alert>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', p: { xs: 2, lg: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            minHeight: 0,
            overflow: 'auto',
            p: 0,
            borderRadius: tokens.radius.xl,
            border: `1px solid ${tokens.neutral[200]}`,
            backgroundColor: tokens.surface.paper,
          }}
        >
          <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            <Stack spacing={2}>
              {unifiedSteps.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    mx: 0,
                    mt: 0,
                    px: { xs: 2, md: 3 },
                    py: { xs: 0.75, md: 1 },
                    borderBottom: `1px solid ${tokens.neutral[200]}`,
                    backgroundColor: tokens.neutral[0],
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="center"
                    spacing={0}
                    sx={{ width: '100%' }}
                  >
                    <Stack
                      direction="row"
                      spacing={3}
                      alignItems="center"
                      flexWrap="wrap"
                      rowGap={1}
                      columnGap={3}
                      justifyContent="center"
                    >
                      <Stack
                        direction="row"
                        spacing={0.6}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                      <IconButton
                        onClick={() => goToStep(activeStepIndex - 1)}
                        disabled={!canGoPrevious}
                        sx={{
                          width: 40,
                          height: 40,
                          border: `1px solid ${jade.soft}`,
                          color: jade.medium,
                          backgroundColor: tokens.neutral[0],
                          '&:hover': {
                            borderColor: jade.medium,
                            backgroundColor: tokens.primary[50],
                          },
                          '&.Mui-disabled': {
                            borderColor: tokens.neutral[200],
                            color: tokens.neutral[400],
                          },
                        }}
                      >
                        <KeyboardArrowLeftIcon fontSize="small" />
                      </IconButton>

                      <Box
                        sx={{
                          maxWidth: '100%',
                          overflowX: 'auto',
                          px: 0.25,
                          mx: 0.25,
                          '&::-webkit-scrollbar': {
                            height: 4,
                          },
                          '&::-webkit-scrollbar-thumb': {
                            backgroundColor: jade.soft,
                            borderRadius: tokens.radius.full,
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0}
                          sx={{ minWidth: 'max-content', alignItems: 'center', pr: 0.25 }}
                          role="tablist"
                          aria-label="Workflow step dock"
                        >
                          {navigatorSteps.map((step, index) => {
                            const state = getNavigatorState(step, index);
                            const isSelected = activeStepIndex === index;
                            const palette = getNavigatorPalette(step, state, isSelected);
                            const buttonBorder = palette.border;
                            const buttonBackground = palette.background;
                            const buttonColor = palette.text;
                            const connectorColor = palette.connector;

                            return (
                              <Stack
                                key={step.type === 'result'
                                  ? `result-${index}`
                                  : `${step.type}-${index}-${step.data.file_path}`
                                }
                                direction="row"
                                alignItems="center"
                                sx={{ flexShrink: 0 }}
                              >
                                <Tooltip title={getNavigatorLabel(step, index)} arrow>
                                  <ButtonBase
                                    ref={(node: HTMLButtonElement | null) => {
                                      dockItemRefs.current[index] = node;
                                    }}
                                    onClick={() => goToStep(index)}
                                    aria-label={`Jump to step ${index + 1}: ${getNavigatorLabel(step, index)}`}
                                    aria-current={isSelected ? 'step' : undefined}
                                    aria-pressed={isSelected}
                                    role="tab"
                                    sx={{
                                      position: 'relative',
                                      width: { xs: 30, sm: 32 },
                                      height: { xs: 30, sm: 32 },
                                      borderRadius: '50%',
                                      border: `1px solid ${buttonBorder}`,
                                      backgroundColor: buttonBackground,
                                      color: buttonColor,
                                      transition: 'border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      boxShadow: palette.shadow,
                                      '&:hover': {
                                        backgroundColor: buttonBackground,
                                        borderColor: buttonBorder,
                                        transform: 'translateY(-1px)',
                                      },
                                      '&:focus-visible': {
                                        outline: `2px solid ${jade.medium}`,
                                        outlineOffset: '2px',
                                      },
                                      '&::after': isSelected ? {
                                        content: '""',
                                        position: 'absolute',
                                        inset: -4,
                                        borderRadius: '50%',
                                        border: `2px solid ${buttonBorder}`,
                                        opacity: 0.22,
                                      } : undefined,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 800,
                                        fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                        color: 'inherit',
                                      }}
                                    >
                                      {index + 1}
                                    </Typography>
                                  </ButtonBase>
                                </Tooltip>
                                {index < navigatorSteps.length - 1 && (
                                  <Box
                                    aria-hidden
                                    sx={{
                                      width: { xs: 22, sm: 28 },
                                      height: 3,
                                      mx: { xs: 0.65, sm: 0.8 },
                                      borderRadius: tokens.radius.full,
                                      backgroundColor: connectorColor,
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                              </Stack>
                            );
                          })}
                        </Stack>
                      </Box>

                      <IconButton
                        onClick={() => goToStep(activeStepIndex + 1)}
                        disabled={!canGoNext}
                        sx={{
                          width: 40,
                          height: 40,
                          border: `1px solid ${canGoNext ? jade.soft : tokens.neutral[200]}`,
                          color: canGoNext ? jade.medium : tokens.neutral[400],
                          backgroundColor: tokens.neutral[0],
                          '&:hover': {
                            borderColor: jade.medium,
                            backgroundColor: tokens.primary[50],
                          },
                          '&.Mui-disabled': {
                            borderColor: tokens.neutral[200],
                            color: tokens.neutral[400],
                          },
                        }}
                      >
                        <KeyboardArrowRightIcon fontSize="small" />
                      </IconButton>
                      </Stack>

                      <Box
                        aria-hidden
                        sx={{
                          width: '1px',
                          height: 32,
                          backgroundColor: tokens.neutral[200],
                          display: { xs: 'none', sm: 'block' },
                        }}
                      />

                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        justifyContent="flex-end"
                        sx={{ flexShrink: 0 }}
                      >
                      <Tooltip title="Advanced workflow tools" arrow>
                        <IconButton
                          onClick={onOpenSettings}
                          sx={{
                            width: 40,
                            height: 40,
                            border: `1px solid ${tokens.neutral[300]}`,
                            color: tokens.neutral[600],
                            backgroundColor: tokens.neutral[0],
                            transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
                            '&:hover': {
                              backgroundColor: tokens.neutral[50],
                              borderColor: tokens.neutral[400],
                            },
                          }}
                        >
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={isAnalyzing ? 'Analyzing all steps' : 'Analyze all'} arrow>
                        <span>
                          <IconButton
                            onClick={handleAnalyzeAll}
                            disabled={isAnalyzing || files.length === 0 || files.every((f) => !f.file_path)}
                            sx={{
                              width: 40,
                              height: 40,
                              border: `1px solid ${jade.soft}`,
                              color: jade.medium,
                              backgroundColor: tokens.neutral[0],
                              transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
                              '&:hover': {
                                backgroundColor: tokens.primary[50],
                                borderColor: jade.medium,
                              },
                              '&.Mui-disabled': {
                                borderColor: tokens.neutral[200],
                                color: tokens.neutral[400],
                                backgroundColor: tokens.neutral[50],
                              },
                            }}
                          >
                            {isAnalyzing ? <CircularProgress size={16} color="primary" /> : <SearchIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Add step" arrow>
                        <IconButton
                          onClick={handleAddFile}
                          sx={{
                            width: 40,
                            height: 40,
                            border: `1px solid ${jade.soft}`,
                            color: jade.medium,
                            backgroundColor: tokens.neutral[0],
                            transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
                            '&:hover': {
                              backgroundColor: tokens.primary[50],
                              borderColor: jade.medium,
                            },
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={isRunning ? 'Workflow running' : 'Run workflow'} arrow>
                        <span>
                          <IconButton
                            onClick={handleRunWorkflowClick}
                            disabled={isRunning || files.length === 0 || files.some((f) => !f.file_path)}
                            sx={{
                              width: 44,
                              height: 44,
                              color: tokens.neutral[0],
                              backgroundColor: jade.strong,
                              boxShadow: `0 8px 14px ${tokens.alpha.primary[20]}`,
                              transition: 'transform 180ms ease, background-color 180ms ease',
                              '&:hover': {
                                backgroundColor: tokens.primary[800],
                                transform: 'translateY(-1px)',
                              },
                              '&.Mui-disabled': {
                                color: tokens.neutral[300],
                                backgroundColor: tokens.neutral[200],
                                boxShadow: 'none',
                              },
                            }}
                          >
                            {isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>

                      {/* Pause/Resume/Cancel buttons in toolbar for visibility during execution */}
                      {isRunning && onPauseWorkflow && (
                        <Tooltip title="Pause workflow" arrow>
                          <IconButton
                            onClick={onPauseWorkflow}
                            disabled={isPausing}
                            sx={{
                              width: 40,
                              height: 40,
                              border: `1px solid ${tokens.warning.border}`,
                              color: tokens.warning.dark,
                              backgroundColor: tokens.neutral[0],
                              transition: 'background-color 180ms ease, border-color 180ms ease',
                              '&:hover': {
                                backgroundColor: tokens.warning.light,
                                borderColor: tokens.warning.dark,
                              },
                              '&.Mui-disabled': {
                                borderColor: tokens.neutral[200],
                                color: tokens.neutral[400],
                              },
                            }}
                          >
                            {isPausing ? <CircularProgress size={16} color="inherit" /> : <PauseIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}

                      {workflowStatus?.status === WorkflowStatus.PAUSED && onResumeWorkflow && (
                        <Tooltip title="Resume workflow" arrow>
                          <IconButton
                            onClick={onResumeWorkflow}
                            disabled={isResuming}
                            sx={{
                              width: 40,
                              height: 40,
                              border: `1px solid ${jade.soft}`,
                              color: jade.medium,
                              backgroundColor: tokens.neutral[0],
                              transition: 'background-color 180ms ease, border-color 180ms ease',
                              '&:hover': {
                                backgroundColor: tokens.primary[50],
                                borderColor: jade.medium,
                              },
                              '&.Mui-disabled': {
                                borderColor: tokens.neutral[200],
                                color: tokens.neutral[400],
                              },
                            }}
                          >
                            {isResuming ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}

                      {(isRunning || workflowStatus?.status === WorkflowStatus.PAUSED) && onStopWorkflow && (
                        <Tooltip title="Cancel workflow" arrow>
                          <IconButton
                            onClick={onStopWorkflow}
                            disabled={isStopping}
                            sx={{
                              width: 40,
                              height: 40,
                              border: `1px solid ${tokens.error.border}`,
                              color: tokens.error.dark,
                              backgroundColor: tokens.neutral[0],
                              transition: 'background-color 180ms ease, border-color 180ms ease',
                              '&:hover': {
                                backgroundColor: tokens.error.light,
                                borderColor: tokens.error.dark,
                              },
                              '&.Mui-disabled': {
                                borderColor: tokens.neutral[200],
                                color: tokens.neutral[400],
                              },
                            }}
                          >
                            {isStopping ? <CircularProgress size={16} color="inherit" /> : <StopIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {warnings.length > 0 && (
                <Tooltip title={warnings.join('\n')} arrow>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: 'fit-content' }}>
                    <InfoIcon fontSize="small" sx={{ color: tokens.warning.dark }} />
                    <Typography variant="body2" color="text.secondary">
                      {warnings.length}
                    </Typography>
                  </Stack>
                </Tooltip>
              )}

              {unifiedSteps.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                    Start with one Mathcad file
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 3 }}>
                    Add a file, analyze it, then wire the outputs into the next step.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddFile}
                    sx={{ minHeight: 44, borderRadius: '99px', textTransform: 'none', fontWeight: 700 }}
                  >
                    Add first step
                  </Button>
                </Box>
              )}

              {activeStep && (
                <Stack spacing={1.5}>
                  <Box
                    role="tabpanel"
                    aria-label={activeStepLabel ? `Workflow step ${activeStepIndex + 1}: ${activeStepLabel}` : `Workflow step ${activeStepIndex + 1}`}
                    sx={{
                      minHeight: 0,
                    }}
                  >
                    {activeResultStep ? (
                      <WorkflowResultView
                        workflowStatus={workflowStatus}
                        progress={workflowProgress}
                        createdFiles={createdFiles}
                        resultSummary={resultSummary}
                        isEmptyState={isEmptyResultState}
                        onPauseWorkflow={onPauseWorkflow}
                        onResumeWorkflow={onResumeWorkflow}
                        onStopWorkflow={onStopWorkflow}
                        onResumeFromCheckpoint={onResumeFromCheckpoint}
                        isRunning={isRunning}
                        isPausing={isPausing}
                        isResuming={isResuming}
                        isStopping={isStopping}
                        currentExecutionLabel={currentExecutionLabel ?? undefined}
                        completedCount={completedCount}
                        totalSteps={Math.max(0, navigatorSteps.length - 1)}
                      />
                    ) : activeCalculationFile ? (
                      <WorkflowStepCard
                        stepIndex={activeStepIndex}
                        file={activeCalculationFile}
                        metadata={filesMetadata[activeCalculationFile.file_path]}
                        stepResult={getStepResult(activeCalculationFile.file_path)}
                        getInputValues={getInputValues}
                        getInputUnits={getInputUnits}
                        getInputCsvSource={getInputCsvSource}
                        isInputMapped={isInputMapped}
                        isInputAutoMapped={isInputAutoMapped}
                        getMappedSource={getMappedSource}
                        onInputValueChange={handleInputValueChange}
                        onInputUnitChange={handleInputUnitChange}
                        onOpenInputModal={handleOpenInputModal}
                        onConfigureMapping={handleConfigureMapping}
                        onUnlockInput={handleUnlockInput}
                        onCsvUnlink={handleCsvUnlink}
                        getOutputUnits={getOutputUnits}
                        onOutputUnitChange={handleOutputUnitChange}
                        onMoveUp={() => handleMoveStep(activeStepIndex, 'up')}
                        onMoveDown={() => handleMoveStep(activeStepIndex, 'down')}
                        onRemove={() => handleRemoveFile(activeCalculationFile.file_path)}
                        onAnalyze={() => onFileSelected?.(activeCalculationFile.file_path)}
                        canMoveUp={canGoPrevious}
                        canMoveDown={canGoNext}
                        mappingCount={getMappingCount(activeCalculationFile.file_path)}
                        isSelected={selectedPill?.stepPosition === activeCalculationFile.position}
                        savePdfMode={getStepSaveMode(activeCalculationFile, 'pdf')}
                        saveMcdxMode={getStepSaveMode(activeCalculationFile, 'mcdx')}
                        onSaveModeChange={(format, mode) => handleStepSaveModeChange(activeCalculationFile.file_path, format, mode)}
                        iterationMode={getStepIterationMode(activeCalculationFile)}
                        onIterationModeChange={(mode) => handleStepIterationModeChange(activeCalculationFile.file_path, mode)}
                      />
                    ) : null}
                  </Box>
                </Stack>
              )}
            </Stack>
          </Stack>
          </Box>
        </Paper>
      </Box>

      {/* InputModal for configuring inputs */}
      <InputModal
        opened={inputModalOpen}
        onClose={() => setInputModalOpen(false)}
        alias={selectedInput?.alias || ''}
        onSave={handleInputConfigSave}
        csvColumnsGrouped={csvColumnsGrouped}
        onCsvColumnSelect={handleInputModalCsvSelect}
        upstreamOutputs={selectedInput ? getUpstreamOutputs(selectedInput.filePath) : []}
        currentMapping={selectedInput ? (() => {
          const m = mappings.find(m => m.target_file === selectedInput.filePath && m.target_alias === selectedInput.alias);
          return m ? { sourceFile: m.source_file, sourceAlias: m.source_alias, sourceType: m.source_type, units: m.units } : null;
        })() : null}
        autoMappingDisabled={selectedInput
          ? autoMappingDisabledTargets.has(toTargetKey(selectedInput.filePath, selectedInput.alias))
          : false}
        onReenableAutoMapping={() => {
          if (!selectedInput) return;
          reenableAutoMapping(selectedInput.filePath, selectedInput.alias);
        }}
        initialConfig={selectedInput ? (() => {
          const file = files.find(f => f.file_path === selectedInput.filePath);
          return file?.inputs?.find(i => i.alias === selectedInput.alias);
        })() : undefined}
        onMappingChange={(mapping) => {
          if (!selectedInput) return;
          const currentMapping = mappings.find(
            m => m.target_file === selectedInput.filePath && m.target_alias === selectedInput.alias
          );
          const mappingChanged = mapping
            ? (
                currentMapping?.source_file !== mapping.sourceFile ||
                currentMapping?.source_alias !== mapping.sourceAlias ||
                (currentMapping?.source_type ?? 'output') !== (mapping.sourceType ?? 'output')
              )
            : Boolean(currentMapping);
          if (mappingChanged) {
            markManualOverride(selectedInput.filePath, selectedInput.alias);
          }

          // D-01: When setting a mapping, also clear the input's value
          if (mapping) {
            const updatedFiles = files.map(f => {
              if (f.file_path !== selectedInput.filePath) return f;
              return {
                ...f,
                inputs: f.inputs.map(inp => {
                  if (inp.alias !== selectedInput.alias) return inp;
                  // Clear the value when mapping is set - mapping takes precedence
                  return { ...inp, value: null };
                })
              };
            });
            onFilesChange(updatedFiles);
          }

          // Remove existing mapping for this input
          const filteredMappings = mappings.filter(
            m => !(m.target_file === selectedInput.filePath && m.target_alias === selectedInput.alias)
          );

          // Add new mapping if provided
          if (mapping) {
            const newMappings = [...filteredMappings, {
              source_file: mapping.sourceFile,
              source_alias: mapping.sourceAlias,
              source_type: mapping.sourceType as 'input' | 'output' | undefined,
              target_file: selectedInput.filePath,
              target_alias: selectedInput.alias,
              units: mapping.units,
            }];
            onMappingsChange(newMappings);
          } else {
            onMappingsChange(filteredMappings);
          }
        }}
      />

      {/* MappingConfigModal for configuring upstream mappings */}
      <MappingConfigModal
        open={mappingModalOpen}
        onClose={() => setMappingModalOpen(false)}
        inputAlias={selectedMappingInput?.alias || ''}
        inputName={selectedMappingInput?.inputName || ''}
        inputType="numeric"
        stepPosition={files.findIndex(f => f.file_path === selectedMappingInput?.filePath) || 0}
        upstreamOutputs={selectedMappingInput ? getUpstreamOutputs(selectedMappingInput.filePath) : []}
        currentMapping={selectedMappingInput ? {
          sourceFile: mappings.find(m => m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias)?.source_file || '',
          sourceAlias: mappings.find(m => m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias)?.source_alias || '',
          sourceType: mappings.find(m => m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias)?.source_type,
          units: mappings.find(m => m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias)?.units,
        } : undefined}
        autoMappingDisabled={selectedMappingInput
          ? autoMappingDisabledTargets.has(toTargetKey(selectedMappingInput.filePath, selectedMappingInput.alias))
          : false}
        onReenableAutoMapping={() => {
          if (!selectedMappingInput) return;
          reenableAutoMapping(selectedMappingInput.filePath, selectedMappingInput.alias);
        }}
        currentValue={selectedMappingInput ? {
          alias: selectedMappingInput.alias,
          value: [],
          inputType: 'number',
          units: getInputUnits(selectedMappingInput.filePath, selectedMappingInput.alias),
        } : undefined}
        onMappingChange={(mapping) => {
          if (!selectedMappingInput) return;
          const currentMapping = mappings.find(
            m => m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias
          );
          const mappingChanged = mapping
            ? (
                currentMapping?.source_file !== mapping.sourceFile ||
                currentMapping?.source_alias !== mapping.sourceAlias ||
                (currentMapping?.source_type ?? 'output') !== (mapping.sourceType ?? 'output')
              )
            : Boolean(currentMapping);
          if (mappingChanged) {
            markManualOverride(selectedMappingInput.filePath, selectedMappingInput.alias);
          }

          // Remove existing mapping for this input
          const filteredMappings = mappings.filter(
            m => !(m.target_file === selectedMappingInput.filePath && m.target_alias === selectedMappingInput.alias)
          );

          // Add new mapping if provided
          if (mapping) {
            const newMappings = [...filteredMappings, {
              source_file: mapping.sourceFile,
              source_alias: mapping.sourceAlias,
              source_type: mapping.sourceType as 'input' | 'output' | undefined,
              target_file: selectedMappingInput.filePath,
              target_alias: selectedMappingInput.alias,
              units: mapping.units,
            }];
            onMappingsChange(newMappings);
          } else {
            onMappingsChange(filteredMappings);
          }
          setMappingModalOpen(false);
        }}
      />
    </Box>
  );
};
