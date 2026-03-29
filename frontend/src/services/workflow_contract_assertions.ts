import { type WorkflowConfig } from './api';

// Compile-time contract assertions for Phase 5 workflow payload fields.
export const phase5WorkflowPayloadShape: WorkflowConfig = {
  name: 'Contract Check',
  files: [
    {
      file_path: 'step-a.mcdx',
      position: 0,
      inputs: [{ alias: 'diameter', value: 10 }],
      save_pdf: true,
      save_mcdx: false,
    },
  ],
  mappings: [],
  stop_on_error: true,
  export_pdf: false,
  export_mcdx: false,
  output_dir_mode: 'custom',
  output_dir: 'results',
};
