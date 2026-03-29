import { useEffect, useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { StepResult, WorkflowCsvTable } from '../../services/api';
import { tokens } from '../../theme/mui-theme';
import iStyles from '../../styles/industrial.module.css';
import styles from './WorkflowCsvResults.module.css';

export interface WorkflowCsvResultsProps {
  stepResults: StepResult[];
  selectedStepIndex?: number | null;
}

const getStepName = (filePath: string): string => {
  if (!filePath) return 'Step';
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  return fileName.replace(/\.[^.]+$/, '');
};

const buildRowData = (table: WorkflowCsvTable) => {
  return table.rows.map((row) => {
    const entry: Record<string, string | number | null> = {};
    table.headers.forEach((header, index) => {
      entry[header] = row[index] ?? null;
    });
    return entry;
  });
};

const buildColumnDefs = (table: WorkflowCsvTable): ColDef[] => {
  return table.headers.map((header) => ({
    headerName: header,
    field: header,
    flex: 1,
    minWidth: 120,
    cellClass: (params) => (typeof params.value === 'number' ? styles.numericCell : undefined),
  }));
};

export const WorkflowCsvResults = ({ stepResults, selectedStepIndex = null }: WorkflowCsvResultsProps) => {
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const stepSections = useMemo(() => {
    return (stepResults ?? [])
      .filter((step) => (step.csv_tables && step.csv_tables.length > 0) || step.csv_error)
      .sort((a, b) => a.step_index - b.step_index);
  }, [stepResults]);

  useEffect(() => {
    if (selectedStepIndex === null || selectedStepIndex === undefined) return;
    const section =
      sectionRefs.current[selectedStepIndex] ??
      stepSections.find((step) => step.step_index >= selectedStepIndex)
        ? sectionRefs.current[
            (stepSections.find((step) => step.step_index >= selectedStepIndex) ?? stepSections[0]).step_index
          ]
        : null;
    if (!section) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
      block: 'center',
    });
  }, [selectedStepIndex, stepSections]);

  if (stepSections.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.neutral[500] }}>
        No CSV tables for this iteration.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5} className={styles.container}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography className={iStyles.techLabel}>CSV Results</Typography>
      </Stack>

      {stepSections.map((step) => (
        <Box
          key={`step-${step.step_index}`}
          ref={(node) => {
            sectionRefs.current[step.step_index] = node as HTMLDivElement | null;
          }}
          className={`${styles.stepSection} ${selectedStepIndex === step.step_index ? styles.stepSectionActive : ''}`}
        >
          <Typography variant="body2" className={styles.stepTitle}>
            Step {step.step_index + 1}: {getStepName(step.file_path)}
          </Typography>

          {step.csv_error && (
            <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
              {step.csv_error}
            </Typography>
          )}

          <Stack spacing={1.25} sx={{ mt: 1 }}>
            {(step.csv_tables ?? []).map((table) => {
              const rowData = buildRowData(table);
              const columnDefs = buildColumnDefs(table);
              const gridHeight = Math.max(76, Math.min(260, 30 + (Math.max(rowData.length, 1) * 28) + 10));
              return (
                <Box key={table.path} className={styles.tableCard}>
                  <Typography variant="body2" className={styles.tableName} title={table.path}>
                    {table.name}
                  </Typography>
                  <div className={`ag-theme-mathcad ${styles.grid}`} style={{ height: gridHeight }}>
                    <AgGridReact
                      rowData={rowData}
                      columnDefs={columnDefs}
                      animateRows={false}
                      pagination={rowData.length > 10}
                      paginationPageSize={50}
                      rowHeight={28}
                      headerHeight={30}
                      theme="legacy"
                    />
                  </div>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

export default WorkflowCsvResults;
