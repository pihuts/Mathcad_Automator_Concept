// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowResultView } from '../workflow/WorkflowResultView';
import type { WorkflowStatusResponse, WorkflowResultSummary, WorkflowCreatedFile } from '../../services/api';
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
  AgGridReact: ({ rowData = [], columnDefs = [] }: { rowData: Array<Record<string, string>>; columnDefs: Array<{ headerName?: string; field?: string }> }) => (
    <table>
      <thead>
        <tr>
          {columnDefs.map((col) => (
            <th key={col.field ?? col.headerName}>{col.headerName ?? col.field}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowData.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columnDefs.map((col) => {
              const key = col.field ?? col.headerName ?? '';
              return <td key={key}>{row[key]}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('../workflow/WorkflowIterationTable', () => ({
  WorkflowIterationTable: () => null,
}));

const makeStatus = (): WorkflowStatusResponse => ({
  workflow_id: 'wf-123',
  status: WorkflowStatus.COMPLETED,
  current_file_index: 0,
  total_files: 2,
  completed_files: [],
  progress: 100,
  step_results: [
    {
      step_index: 0,
      file_path: 'alpha-step.mcdx',
      status: 'completed',
      outputs: {},
      retry_count: 0,
      iteration_index: 0,
      csv_tables: [
        {
          path: 'D:/runs/iter-1/0.csv',
          name: '0.csv',
          headers: ['Torque', 'Speed'],
          rows: [[12, 4], [14, 5]],
        },
      ],
    },
    {
      step_index: 1,
      file_path: 'beta-step.mcdx',
      status: 'completed',
      outputs: {},
      retry_count: 0,
      iteration_index: 0,
      csv_tables: [
        {
          path: 'D:/runs/iter-1/1.csv',
          name: '1.csv',
          headers: ['Voltage'],
          rows: [[120]],
        },
      ],
    },
  ],
  created_files: [],
  result_summary: {
    completed_steps: 2,
    total_steps: 2,
    completed_iterations: 1,
    total_iterations: 1,
    created_file_count: 0,
    pdf_count: 0,
    mcdx_count: 0,
  },
});

const summary: WorkflowResultSummary = {
  completed_steps: 2,
  total_steps: 2,
  completed_iterations: 1,
  total_iterations: 1,
  created_file_count: 0,
  pdf_count: 0,
  mcdx_count: 0,
};

const renderResultView = () => {
  const createdFiles: WorkflowCreatedFile[] = [];
  render(
    <WorkflowResultView
      workflowStatus={makeStatus()}
      progress={100}
      createdFiles={createdFiles}
      resultSummary={summary}
      isEmptyState={false}
      currentExecutionLabel="Workflow result"
      completedCount={2}
      totalSteps={2}
    />
  );
};

afterEach(() => {
  cleanup();
});

describe('WorkflowResultView experimental CSV results', () => {
  it('renders flat step sections for selected iteration csv tables', async () => {
    const user = userEvent.setup();
    renderResultView();

    await user.click(screen.getAllByRole('tab', { name: 'CSV Results' })[0]);

    expect(screen.getAllByText('CSV Results').length).toBeGreaterThan(0);
    expect(screen.getByText('Step 1: alpha-step')).toBeTruthy();
    expect(screen.getByText('Step 2: beta-step')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Step 1: alpha-step/i })).toBeNull();
  });

  it('renders csv table headers and row values', async () => {
    const user = userEvent.setup();
    renderResultView();

    await user.click(screen.getAllByRole('tab', { name: 'CSV Results' })[0]);

    const csvPanel = screen.getByText('Step 1: alpha-step').closest('div');
    expect(csvPanel).toBeTruthy();
    if (csvPanel) {
      expect(within(csvPanel).getByText('Torque')).toBeTruthy();
      expect(within(csvPanel).getByText('Speed')).toBeTruthy();
      expect(within(csvPanel).getByText('12')).toBeTruthy();
    }
  });
});
