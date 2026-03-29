/**
 * WorkflowIterationTable.tsx
 * AG Grid table displaying inputs/outputs per step per iteration.
 */

import React, { useMemo } from 'react';
import { Chip } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { StepResult, WorkflowIterationRow, StepStatusType } from '../../services/api';
import { getStatusTone } from '../../utils/workflowStatus';
import styles from './WorkflowIterationTable.module.css';

export interface WorkflowIterationTableProps {
  stepResults: StepResult[];
  onStepSelect?: (stepIndex: number) => void;
}

interface StatusRendererParams extends ICellRendererParams<WorkflowIterationRow> {
  value: string;
}

const StatusRenderer = (params: StatusRendererParams) => {
  const status = params.value as StepStatusType;
  const tone = getStatusTone(status);

  return (
    <Chip
      label={status}
      size="small"
      variant="outlined"
      aria-label={`Status: ${status}`}
      role="status"
      sx={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        color: tone.text,
        fontWeight: 700,
        fontSize: '0.75rem',
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
};

function deriveStepName(filePath: string): string {
  const filename = filePath.split(/[/\\]/).pop() ?? filePath;
  if (filename.startsWith('[Condition:')) return filename;
  return filename.replace(/\.(mcdx|xmpdx)$/i, '');
}

const toDisplayAlias = (alias: string): string => {
  const match = alias.match(/^\d+\.(.+)$/);
  return match ? match[1] : alias;
};

const toHeaderAlias = (aliases: string[]): string => {
  const display = aliases.map(toDisplayAlias).filter(Boolean);
  const unique = [...new Set(display)];
  return unique.join(' / ');
};

function transformStepResults(stepResults: StepResult[]): WorkflowIterationRow[] {
  return stepResults.map((sr) => ({
    iterationId: sr.iteration_id ?? 'N/A',
    iterationIndex: sr.iteration_index ?? 0,
    stepIndex: sr.step_index,
    stepName: deriveStepName(sr.file_path),
    status: sr.status,
    inputs: sr.inputs ?? {},
    outputs: sr.outputs ?? {},
    error: [sr.error, sr.error_detail].filter(Boolean).join(' | '),
  }));
}

const valueToString = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

const toDisplayIteration = (iterationIndex: number | null | undefined): number => {
  if (iterationIndex === null || iterationIndex === undefined) return 1;
  return iterationIndex <= 0 ? iterationIndex + 1 : iterationIndex;
};

export const WorkflowIterationTable: React.FC<WorkflowIterationTableProps> = React.memo(({
  stepResults,
  onStepSelect,
}) => {
  const rows = useMemo(() => transformStepResults(stepResults), [stepResults]);

  const { inputKeys, outputKeys } = useMemo(() => {
    if (!rows.length) return { inputKeys: [] as [string, string[]][], outputKeys: [] as [string, string[]][] };

    const buildDisplayMap = (keys: string[]) => {
      const map = new Map<string, string[]>();
      keys.forEach((key) => {
        const display = toDisplayAlias(key);
        const existing = map.get(display) ?? [];
        if (!existing.includes(key)) {
          existing.push(key);
          map.set(display, existing);
        }
      });
      return map;
    };

    const inputKeyMap = buildDisplayMap(rows.flatMap((r) => Object.keys(r.inputs)));
    const outputKeyMap = buildDisplayMap(rows.flatMap((r) => Object.keys(r.outputs)));

    return {
      inputKeys: Array.from(inputKeyMap.entries()),
      outputKeys: Array.from(outputKeyMap.entries()),
    };
  }, [rows]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      {
        field: 'iterationIndex',
        headerName: 'Iteration',
        width: 90,
        pinned: 'left',
        valueFormatter: (p) => String(toDisplayIteration(p.value as number | null | undefined)),
        cellClass: styles.monoCell,
      },
      {
        field: 'stepName',
        headerName: 'Step',
        width: 170,
        pinned: 'left',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        pinned: 'left',
        cellRenderer: StatusRenderer,
      },
    ];

    inputKeys.forEach(([displayKey, rawKeys]) => {
      cols.push({
        headerName: `Input: ${toHeaderAlias(rawKeys) || displayKey}`,
        valueGetter: (params) => {
          const value = rawKeys
            .map((key) => params.data.inputs?.[key])
            .find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
          return valueToString(value);
        },
        flex: 1,
        minWidth: 120,
        cellClass: styles.monoCell,
      });
    });

    outputKeys.forEach(([displayKey, rawKeys]) => {
      cols.push({
        headerName: `Output: ${toHeaderAlias(rawKeys) || displayKey}`,
        valueGetter: (params) => {
          const value = rawKeys
            .map((key) => params.data.outputs?.[key])
            .find((candidate) => candidate !== undefined && candidate !== null && candidate !== '');
          return valueToString(value);
        },
        flex: 1,
        minWidth: 120,
        cellClass: styles.monoCell,
      });
    });

    cols.push({
      field: 'error',
      headerName: 'Error / Detail',
      flex: 2,
      minWidth: 220,
      pinned: 'right',
      cellClass: `${styles.monoCell} ${styles.errorCell}`,
    });

    return cols;
  }, [inputKeys, outputKeys]);

  return (
    <div className={styles.gridContainer}>
      <div className="ag-theme-mathcad" style={{ width: '100%' }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          animateRows={false}
          pagination={false}
          rowHeight={28}
          headerHeight={30}
          domLayout="autoHeight"
          onRowClicked={(event) => {
            const idx = event.data?.stepIndex;
            if (typeof idx === 'number') {
              onStepSelect?.(idx);
            }
          }}
          onCellKeyDown={(event) => {
            const key = (event.event as KeyboardEvent | undefined)?.key;
            if (key === 'Enter' || key === ' ') {
              const idx = event.data?.stepIndex;
              if (typeof idx === 'number') {
                (event.event as KeyboardEvent)?.preventDefault();
                onStepSelect?.(idx);
              }
            }
          }}
          rowClass={onStepSelect ? styles.clickableRow : undefined}
          theme="legacy"
        />
      </div>
    </div>
  );
});
