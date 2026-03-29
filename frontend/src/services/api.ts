import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

// Type for input/output values that can be various primitives or arrays
export type InputValue = string | number | boolean | null | (string | number)[];

export interface BatchRequest {
  batch_id: string;
  inputs: Record<string, InputValue>[];
  output_dir?: string;
  output_dir_mode?: OutputDirMode;
  source_file_path?: string;
  export_pdf: boolean;
  export_mcdx: boolean;
  mode?: 'combination' | 'zip';  // Batch iteration mode: all permutations or paired by row
  output_units?: Record<string, string>;  // Units for output variables
}

export type StringTransform = 'uppercase' | 'lowercase' | 'as-is';

export interface InputConfig {
  alias: string;
  value: InputValue;
  units?: string;  // Units specification (e.g., "in", "ft", "kip", or undefined for default)
  inputType?: 'number' | 'string';  // Type of input selected by user in InputModal
  stringTransform?: StringTransform;  // Transform applied to string inputs
  csvSource?: {    // For CSV column reference
    fileId: string;
    column: string;
  };
}

export interface BatchRow {
  row: number;
  status: string;
  stage?: string;
  inputs?: Record<string, InputValue>;  // Input values used for this iteration
  data?: Record<string, InputValue>;
  pdf?: string;
  mcdx?: string;
  error?: string;
}

export interface BatchStatus {
  id: string;
  total: number;
  completed: number;
  status: string;
  results: BatchRow[];
  generated_files?: string[];
  error?: string;
}

export interface ControlResponse {
  status: string;
  message: string;
}

export interface JobResponse {
  job_id: string;
  status: string;
}

export interface MetaData {
  inputs: Array<{ alias: string, name: string }>;
  outputs: Array<{ alias: string, name: string }>;
}

export type MappingSourceType = 'input' | 'output';

export interface FileMapping {
  source_file: string;
  source_alias: string;
  source_type?: MappingSourceType;  // Whether the source is an input or output from the previous step
  target_file: string;
  target_alias: string;
  units?: string;  // Expected units for the target input (e.g., "in", "ft", "kip")
}

export interface WorkflowFile {
  file_path: string;
  inputs: InputConfig[];
  position: number;
  save_pdf?: boolean | null;
  save_mcdx?: boolean | null;
  mode?: 'combination' | 'zip';
  output_units?: Record<string, string>;  // Units for output variables
}

export type OutputDirMode = 'working' | 'source' | 'custom';

export interface WorkflowConfig {
  name: string;
  files: WorkflowFile[];
  mappings: FileMapping[];
  stop_on_error: boolean;
  export_pdf: boolean;
  export_mcdx: boolean;
  output_dir?: string;
  output_dir_mode?: OutputDirMode;
  iteration_mode?: 'combination' | 'zip';
  // Phase 7 additions
  failure_mode?: string; // "stop_on_error" | "retry" | "continue"
  retry_config?: RetryConfig;
  pause_mode?: string; // "auto_run" | "pause_each"
  conditions?: ConditionalTermination[];
  aggregation_mappings?: AggregationMapping[];
}

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "paused";

export const WorkflowStatus = {
  PENDING: "pending" as WorkflowStatus,
  RUNNING: "running" as WorkflowStatus,
  COMPLETED: "completed" as WorkflowStatus,
  FAILED: "failed" as WorkflowStatus,
  STOPPED: "stopped" as WorkflowStatus,
  PAUSED: "paused" as WorkflowStatus,
} as const;

export interface WorkflowStatusResponse {
  workflow_id: string;
  status: string;
  current_file_index: number;
  total_files: number;
  completed_files: string[];
  progress: number;
  error?: string;
  // Phase 7 additions
  step_results?: StepResult[];
  paused_at_step?: number | null;
  termination_message?: string;
  checkpoint_path?: string;
  pause_mode?: string;
  failure_mode?: string;
  created_files?: WorkflowCreatedFile[];
  result_summary?: WorkflowResultSummary;
}

// Phase 7: Workflow Overhaul Types

export type StepStatusType =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";

export interface WorkflowCsvTable {
  path: string;
  name: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

export interface StepResult {
  step_index: number;
  file_path: string;
  status: StepStatusType;
  outputs: Record<string, InputValue>;
  error?: string;
  error_detail?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  // Iteration context and inputs - added by phase 16
  inputs?: Record<string, InputValue>;
  input_units?: Record<string, string | null>;
  iteration_id?: string | null;
  iteration_index?: number | null;
  csv_tables?: WorkflowCsvTable[];
  csv_error?: string | null;
}

export interface WorkflowIterationRow {
  iterationId: string;
  iterationIndex: number;
  stepIndex: number;
  stepName: string;
  status: StepStatusType;
  inputs: Record<string, InputValue>;
  outputs: Record<string, InputValue>;
  error?: string;
}

export interface WorkflowCreatedFile {
  path: string;
  name: string;
  format: 'pdf' | 'mcdx' | 'other' | string;
  step_index: number;
  step_name: string;
  iteration_id?: string | null;
}

export interface WorkflowResultSummary {
  completed_steps: number;
  total_steps: number;
  completed_iterations: number;
  total_iterations: number;
  created_file_count: number;
  pdf_count: number;
  mcdx_count: number;
  current_step_label?: string | null;
  last_completed_step_label?: string | null;
}

export interface ConditionalTermination {
  expression: string;
  outcome: string; // "success" or "failure"
  message?: string;
  after_step: number; // -1 = after every step
}

export interface RetryConfig {
  max_retries: number;
  min_wait: number;
  max_wait: number;
  multiplier: number;
}

export interface AggregationMapping {
  expression: string;
  target_file: string;
  target_alias: string;
  units?: string;
}

export interface MappingSuggestion {
  source_alias: string;
  target_alias: string;
  confidence: number;
  reason: string;
}

export interface ExpressionValidation {
  valid: boolean;
  error: string;
}

export interface WorkflowCreateResponse {
  workflow_id: string;
  status: string;
}

export const startBatch = async (config: BatchRequest): Promise<ControlResponse> => {
  const { data } = await api.post<ControlResponse>('/batch/start', config);
  return data;
};

export const getBatchStatus = async (id: string): Promise<BatchStatus> => {
  const { data } = await api.get<BatchStatus>(`/batch/${id}`);
  return data;
};

export const stopBatch = async (id: string): Promise<ControlResponse> => {
  const { data } = await api.post<ControlResponse>(`/batch/${id}/stop`);
  return data;
};

export const getInputs = async (path: string): Promise<MetaData> => {
  const { data } = await api.post<MetaData>('/engine/analyze', { path });
  return data;
};

export const createWorkflow = async (config: WorkflowConfig): Promise<WorkflowCreateResponse> => {
  console.log('[createWorkflow API] Sending workflow config:', JSON.stringify(config, null, 2));
  console.log('[createWorkflow API] Files count:', config.files.length);
  config.files.forEach((f, i) => {
    console.log(`[createWorkflow API] File ${i}: path=${f.file_path}, inputs=${JSON.stringify(f.inputs)}`);
  });
  const { data } = await api.post<WorkflowCreateResponse>('/workflows', config);
  return data;
};

export const getWorkflowStatus = async (workflowId: string): Promise<WorkflowStatusResponse> => {
  const { data } = await api.get<WorkflowStatusResponse>(`/workflows/${workflowId}`);
  return data;
};

export const stopWorkflow = async (workflowId: string): Promise<ControlResponse> => {
  const { data } = await api.post<ControlResponse>(`/workflows/${workflowId}/stop`);
  return data;
};

// Phase 7: Workflow Control API

export const openFile = async (path: string): Promise<{ status: string }> => {
  const { data } = await api.post<{ status: string }>('/files/open', { path });
  return data;
};

export const browseFile = async (): Promise<{ file_path: string | null; cancelled: boolean }> => {
  const { data } = await api.post<{ file_path: string | null; cancelled: boolean }>('/files/browse');
  return data;
};

// Settings API

export interface OutputDirSettingsRequest {
  mode: OutputDirMode;
  custom_path?: string;
  source_file_path?: string;
}

export interface OutputDirSettingsResponse {
  valid: boolean;
  resolved_path?: string;
  error?: string;
  mode: OutputDirMode;
}

export const validateOutputDir = async (req: OutputDirSettingsRequest): Promise<OutputDirSettingsResponse> => {
  const { data } = await api.post<OutputDirSettingsResponse>('/settings/output-dir', req);
  return data;
};

export const browseFolder = async (): Promise<{ path: string | null; cancelled: boolean }> => {
  const { data } = await api.get<{ path: string | null; cancelled: boolean }>('/settings/folder-picker');
  return data;
};

// Library Types

export interface LibraryConfigMetadata {
  name: string;
  path: string;
  created_at: string;
  version: string;
}

export interface ListLibraryConfigsResponse {
  configs: LibraryConfigMetadata[];
}

export interface SaveLibraryConfigRequest {
  name: string;
  file_path: string;
  inputs: InputConfig[];
  export_pdf: boolean;
  export_mcdx: boolean;
  output_dir?: string;
}

export interface SaveLibraryConfigResponse {
  status: string;
  config_path: string;
  config_name: string;
}

export interface LoadLibraryConfigRequest {
  config_path: string;
}

export type LoadLibraryConfigResponse = SaveLibraryConfigRequest; // BatchConfig structure

// Library API Functions

export const saveLibraryConfig = async (config: SaveLibraryConfigRequest): Promise<SaveLibraryConfigResponse> => {
  const { data } = await api.post<SaveLibraryConfigResponse>('/library/save', config);
  return data;
};

export const listLibraryConfigs = async (filePath: string): Promise<ListLibraryConfigsResponse> => {
  const { data } = await api.get<ListLibraryConfigsResponse>('/library/list', {
    params: { file_path: filePath }
  });
  return data;
};

export const loadLibraryConfig = async (configPath: string): Promise<LoadLibraryConfigResponse> => {
  const { data } = await api.post<LoadLibraryConfigResponse>('/library/load', { config_path: configPath });
  return data;
};

// Workflow Library Types

export interface WorkflowLibraryConfigMetadata {
  name: string;
  path: string;
  created_at: string;
  files_count: number;
}

export interface ListWorkflowLibraryConfigsResponse {
  configs: WorkflowLibraryConfigMetadata[];
}

export interface SaveWorkflowLibraryConfigRequest {
  name: string;
  files: WorkflowFile[];
  mappings: FileMapping[];
  stop_on_error: boolean;
  export_pdf: boolean;
  export_mcdx: boolean;
  output_dir?: string;
  iteration_mode?: 'combination' | 'zip';
  // Phase 7 additions
  failure_mode?: string;
  retry_config?: RetryConfig;
  pause_mode?: string;
  conditions?: ConditionalTermination[];
}

export type LoadWorkflowLibraryConfigResponse = WorkflowConfig;

// Workflow Library API Functions

export const saveWorkflowLibraryConfig = async (config: SaveWorkflowLibraryConfigRequest): Promise<SaveLibraryConfigResponse> => {
  const { data } = await api.post<SaveLibraryConfigResponse>('/library/save/workflow', config);
  return data;
};

export const listWorkflowLibraryConfigs = async (): Promise<ListWorkflowLibraryConfigsResponse> => {
  const { data } = await api.get<ListWorkflowLibraryConfigsResponse>('/library/list/workflows');
  return data;
};

export const loadWorkflowLibraryConfig = async (configPath: string): Promise<LoadWorkflowLibraryConfigResponse> => {
  const { data } = await api.post<LoadWorkflowLibraryConfigResponse>('/library/load/workflow', { config_path: configPath });
  return data;
};

export default api;
