// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  WorkflowIterationTable: ({ stepResults }: { stepResults: unknown[] }) => <div>{`iteration-rows:${stepResults.length}`}</div>,
}));

const summary: WorkflowResultSummary = {
  completed_steps: 4,
  total_steps: 4,
  completed_iterations: 2,
  total_iterations: 2,
  created_file_count: 0,
  pdf_count: 0,
  mcdx_count: 0,
};

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
      outputs: { phiVn: 0.9 },
      retry_count: 0,
      iteration_index: 0,
      inputs: { P: 1, beamDepth: 2 },
    },
    {
      step_index: 1,
      file_path: 'beta-step.mcdx',
      status: 'completed',
      outputs: { phiPn: 0.8 },
      retry_count: 0,
      iteration_index: 0,
      inputs: { a: 3 },
    },
    {
      step_index: 0,
      file_path: 'gamma-step.mcdx',
      status: 'failed',
      outputs: {},
      retry_count: 0,
      iteration_index: 1,
      error: 'ErrorCode 6: boom',
      error_detail: 'ErrorCode 6 from backend',
      inputs: { P: 9, beamWidth: 11 },
    },
  ],
  created_files: [],
  result_summary: summary,
});

const setViewport = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width:900px') ? desktop : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderResultView = (desktop = true) => {
  setViewport(desktop);
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

beforeEach(() => {
  setViewport(true);
});

afterEach(() => {
  cleanup();
});

describe('WorkflowResultView layout', () => {
  it('orders run cards by iteration index and updates active workspace selection', async () => {
    const user = userEvent.setup();
    renderResultView(true);

    const cards = screen.getAllByRole('button', { name: 'Iteration 1' });
    expect(cards.length).toBe(2);

    await user.click(cards[1]);
    expect(screen.queryByText('Workflows > Iteration 2')).toBeNull();
    expect(screen.queryByText('gamma-step.mcdx')).toBeNull();
    const errorBadge = screen.getByText('ErrorCode 6').closest('.MuiChip-root');
    expect(errorBadge).toBeTruthy();
    if (errorBadge) {
      expect(errorBadge.className).toContain('errorCodeBadge');
    }
  });

  it('updates execution table rows after iteration selection changes', async () => {
    const user = userEvent.setup();
    renderResultView(true);

    expect(screen.getByText('iteration-rows:2')).toBeTruthy();

    const cards = screen.getAllByRole('button', { name: 'Iteration 1' });
    await user.click(cards[1]);
    expect(screen.getByText('iteration-rows:1')).toBeTruthy();
  });

  it('shows desktop persistent rail and mobile drawer trigger path', () => {
    renderResultView(true);
    expect(screen.getByRole('navigation', { name: 'Result run list' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open run list' })).toBeNull();

    cleanup();
    renderResultView(false);
    expect(screen.getByRole('button', { name: 'Open run list' })).toBeTruthy();
  });

});
