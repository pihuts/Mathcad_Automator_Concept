// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowResultView } from '../workflow/WorkflowResultView';
import type { WorkflowStatusResponse } from '../../services/api';
import { WorkflowStatus } from '../../services/api';

vi.mock('@mui/icons-material', () => ({
  Pause: () => null,
  Stop: () => null,
  CheckCircle: () => null,
  Refresh: () => null,
  FolderOpen: () => null,
  Description: () => null,
  PictureAsPdf: () => null,
  InsertDriveFile: () => null,
  Error: () => null,
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: () => null,
}));

vi.mock('../workflow/WorkflowIterationTable', () => ({
  WorkflowIterationTable: () => null,
}));

describe('WorkflowResultView semantics', () => {
  it('keeps header fallback, KPI display, and raw error/detail text display-only', () => {
    const status: WorkflowStatusResponse = {
      workflow_id: 'wf-semantics',
      status: WorkflowStatus.FAILED,
      current_file_index: 0,
      total_files: 1,
      completed_files: [],
      progress: 100,
      step_results: [
        {
          step_index: 0,
          file_path: '',
          status: 'failed',
          outputs: {},
          retry_count: 0,
          iteration_index: 0,
          error: 'ErrorCode 6: upstream error',
          error_detail: 'detail-from-engine',
        },
      ],
      created_files: [],
      result_summary: {
        completed_steps: 1,
        total_steps: 1,
        completed_iterations: 1,
        total_iterations: 1,
        created_file_count: 0,
        pdf_count: 0,
        mcdx_count: 0,
      },
    };

    render(
      <WorkflowResultView
        workflowStatus={status}
        progress={100}
        createdFiles={[]}
        resultSummary={status.result_summary ?? null}
        isEmptyState={false}
      />
    );

    expect(screen.getByText('Step 1 (Worksheet.mcdx)')).toBeTruthy();
    expect(screen.getByText('ErrorCode 6: upstream error')).toBeTruthy();
    expect(screen.getByText('detail-from-engine')).toBeTruthy();
    expect(screen.queryByText(/root cause/i)).toBeNull();
  });
});
