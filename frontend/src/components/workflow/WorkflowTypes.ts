/**
 * WorkflowTypes.ts
 * Shared types and interfaces for workflow components.
 *
 * These types are used across the workflow UI components including:
 * - WorkflowView (main container)
 * - WorkflowNavigator (step dock)
 * - WorkflowStepCard
 * - WorkflowResultView
 */

import type {
  WorkflowFile,
  FileMapping,
  StepResult,
  MetaData,
  WorkflowStatusResponse,
  WorkflowCreatedFile,
  WorkflowResultSummary,
} from '../../services/api';

// Re-export API types that are commonly used in workflow components
export type {
  WorkflowFile,
  FileMapping,
  StepResult,
  MetaData,
  WorkflowStatusResponse,
  WorkflowCreatedFile,
  WorkflowResultSummary,
};

/**
 * Represents a unified step in the workflow, which can be either
 * a calculation step (Mathcad file) or a conditional step (branch logic).
 */
export type UnifiedStep =
  | { type: 'calculation'; data: WorkflowFile; arrayIndex: number };

/**
 * Represents a step in the navigator dock, which includes
 * calculation steps, conditional steps, and the result summary step.
 */
export type NavigatorStep = UnifiedStep | { type: 'result' };

/**
 * Navigation state for a step in the dock.
 * - idle: not yet processed
 * - complete: successfully processed
 * - active: currently being processed
 * - error: failed during processing
 */
export type NavigatorState = 'idle' | 'complete' | 'active' | 'error';

/**
 * Palette configuration for navigator step styling.
 */
export interface NavigatorPalette {
  border: string;
  background: string;
  text: string;
  connector: string;
  shadow: string;
}

/**
 * Available variable for condition expressions.
 * Contains the variable alias and its source step.
 */
export interface AvailableVariable {
  alias: string;
  source: string;
}

/**
 * Information about a mapped input source.
 */
export interface MappedSourceInfo {
  stepIndex: number;
  stepLabel: string;
  outputAlias: string;
}

/**
 * Save mode for step-level export settings.
 * - inherit: use parent/default setting (undefined)
 * - global: use global workflow setting (null)
 * - on: always export this format
 * - off: never export this format
 */
export type StepSaveMode = 'inherit' | 'global' | 'on' | 'off';

/**
 * Iteration mode for a workflow step.
 */
export type IterationMode = 'combination' | 'zip';

/**
 * Props for the WorkflowView component.
 */
export interface WorkflowViewProps {
  /** List of workflow files (calculation steps) */
  files: WorkflowFile[];
  /** List of input/output mappings between steps */
  mappings: FileMapping[];
  /** Callback when files list changes */
  onFilesChange: (files: WorkflowFile[]) => void;
  /** Callback when mappings list changes */
  onMappingsChange: (mappings: FileMapping[]) => void;
  /** Currently selected input pill (for highlighting) */
  selectedPill?: { stepPosition: number; inputAlias: string } | null;
  /** Callback when a file is selected */
  onFileSelected?: (filePath: string) => void;
  /** Callback to analyze all workflow files */
  onAnalyzeAll?: (filePaths: string[]) => Promise<void>;
  /** Step execution results from backend */
  stepResults?: StepResult[];
  /** Metadata for each workflow file (inputs/outputs) */
  filesMetadata?: Record<string, MetaData>;
  /** Callback to run the workflow */
  onRunWorkflow: () => void;
  /** Whether workflow is currently running */
  isRunning: boolean;
  /** Callback to open workflow settings */
  onOpenSettings: () => void;
  /** Current workflow status from backend */
  workflowStatus?: WorkflowStatusResponse | null;
  /** Overall workflow progress (0-100) */
  workflowProgress?: number;
  /** Iteration mode for the workflow */
  workflowIterationMode: IterationMode;
  /** Callback when iteration mode changes */
  onWorkflowIterationModeChange: (mode: IterationMode) => void;
  /** Warning messages to display */
  warnings: string[];
  /** Callback to pause the workflow */
  onPauseWorkflow?: () => void;
  /** Callback to resume the workflow */
  onResumeWorkflow?: () => void;
  /** Callback to stop the workflow */
  onStopWorkflow?: () => void;
  /** Callback to resume from a checkpoint */
  onResumeFromCheckpoint?: () => void;
  /** Whether a pause operation is in progress */
  isPausing?: boolean;
  /** Whether a resume operation is in progress */
  isResuming?: boolean;
  /** Whether a stop operation is in progress */
  isStopping?: boolean;
  /** Grouped CSV columns from global state */
  csvColumnsGrouped?: Array<{
    group: string;
    columns: Array<{ value: string; label: string; preview: string[] }>;
  }>;
  /** Callback when CSV column is selected */
  onCsvColumnSelect?: (fileId: string, column: string) => void;
}

/**
 * Props for the WorkflowNavigator component.
 */
export interface WorkflowNavigatorProps {
  /** List of navigator steps to display */
  steps: NavigatorStep[];
  /** Index of the currently active/selected step */
  activeStepIndex: number;
  /** Callback when a step is selected */
  onStepSelect: (index: number) => void;
  /** Index of the currently executing step (null if not running) */
  executionStepIndex?: number | null;
  /** Get the display label for a step */
  getStepLabel: (step: NavigatorStep, index: number) => string;
  /** Get the navigation state for a step */
  getStepState: (step: NavigatorStep, index: number) => NavigatorState;
  /** Get the palette/styling for a step */
  getStepPalette: (step: NavigatorStep, state: NavigatorState, isSelected: boolean) => NavigatorPalette;
  /** Whether navigation is disabled */
  disabled?: boolean;
  /** Ref object for storing step button refs */
  stepRefs?: React.MutableRefObject<Record<number, HTMLButtonElement | null>>;
}

/**
 * Props for the WorkflowResultView component.
 */
export interface WorkflowResultViewProps {
  /** Current workflow status */
  workflowStatus?: WorkflowStatusResponse | null;
  /** Overall workflow progress (0-100) */
  progress: number;
  /** List of created files from workflow execution */
  createdFiles: WorkflowCreatedFile[];
  /** Result summary statistics */
  resultSummary: WorkflowResultSummary | null;
  /** Whether this is the empty/initial state */
  isEmptyState: boolean;
  /** Callback to open a created file */
  onOpenFile?: (path: string) => void;
  /** Callback to run the workflow */
  onRunWorkflow?: () => void;
  /** Callback to pause the workflow */
  onPauseWorkflow?: () => void;
  /** Callback to resume the workflow */
  onResumeWorkflow?: () => void;
  /** Callback to stop the workflow */
  onStopWorkflow?: () => void;
  /** Callback to resume from checkpoint */
  onResumeFromCheckpoint?: () => void;
  /** Whether workflow is currently running */
  isRunning?: boolean;
  /** Whether a pause operation is in progress */
  isPausing?: boolean;
  /** Whether a resume operation is in progress */
  isResuming?: boolean;
  /** Whether a stop operation is in progress */
  isStopping?: boolean;
}

/**
 * Props for step card components.
 */
export interface WorkflowStepCardBaseProps {
  /** The workflow file for this step */
  file: WorkflowFile;
  /** Step position index */
  position: number;
  /** Step execution result (if available) */
  stepResult?: StepResult;
  /** Whether this step is currently active/selected */
  isActive?: boolean;
  /** Whether this step is currently executing */
  isExecuting?: boolean;
  /** Whether move up is available */
  canMoveUp?: boolean;
  /** Whether move down is available */
  canMoveDown?: boolean;
  /** Callback to remove this step */
  onRemove?: () => void;
  /** Callback to move this step */
  onMove?: (direction: 'up' | 'down') => void;
  /** Callback to add a condition after this step */
  onAddConditionAfter?: () => void;
}

/**
 * Input selection state for modals.
 */
export interface InputSelection {
  filePath: string;
  alias: string;
  inputName: string;
}

/**
 * CSV column group structure for selectors.
 */
export interface CsvColumnGroup {
  group: string;
  columns: Array<{
    value: string;
    label: string;
    preview: string[];
  }>;
}

/**
 * Upstream output option for mapping selectors.
 */
export interface UpstreamOutputOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Created files grouped by step.
 */
export interface CreatedFilesByStep {
  key: string;
  stepIndex: number;
  stepName: string;
  files: WorkflowCreatedFile[];
}
