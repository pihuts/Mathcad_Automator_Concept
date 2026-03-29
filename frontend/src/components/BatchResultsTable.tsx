import React, { useMemo, useCallback } from 'react';
import { Box, Button, Stack, Typography, Link } from '@mui/material';
import { Download as DownloadIcon, PictureAsPdf as PdfIcon, Description as McdxIcon } from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { exportToCsv } from '../utils/csv_parser';
import type { BatchRow } from '../services/api';

export interface BatchResultsTableProps {
  results: BatchRow[];
  onViewPdf?: (path: string) => void;
  onViewMcdx?: (path: string) => void;
}

export const BatchResultsTable: React.FC<BatchResultsTableProps> = React.memo(({
  results,
  onViewPdf,
  onViewMcdx
}) => {
  // Extract column keys once — depends on results.length only, not full array
  const { inputKeys, outputKeys } = useMemo(() => {
    if (!results || results.length === 0) return { inputKeys: [] as string[], outputKeys: [] as string[] };
    const firstWithInputs = results.find(r => r.inputs && Object.keys(r.inputs).length > 0);
    const firstWithData = results.find(r => r.data && Object.keys(r.data).length > 0);
    return {
      inputKeys: firstWithInputs?.inputs ? Object.keys(firstWithInputs.inputs) : [],
      outputKeys: firstWithData?.data ? Object.keys(firstWithData.data) : [],
    };
  }, [results.length]);

  // Generate columns — stable unless input/output keys change
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      { field: 'row', headerName: 'Iteration', width: 90, pinned: 'left', valueFormatter: (p) => (p.value + 1) },
      { field: 'status', headerName: 'Status', width: 100, pinned: 'left' },
    ];

    inputKeys.forEach(key => {
      cols.push({
        headerName: `Input: ${key}`,
        valueGetter: (params) => params.data.inputs?.[key] ?? '',
        flex: 1,
        minWidth: 100,
      });
    });

    outputKeys.forEach(key => {
      cols.push({
        headerName: `Output: ${key}`,
        valueGetter: (params) => params.data.data?.[key] ?? '',
        flex: 1,
        minWidth: 100,
      });
    });

    // Add error column
    cols.push({
      field: 'error',
      headerName: 'Error',
      flex: 2,
      minWidth: 200,
    });

    // Add PDF column with clickable filename
    cols.push({
      field: 'pdf',
      headerName: 'PDF',
      width: 150,
      cellRenderer: (params: any) => {
        const pdfPath = params.value;
        if (!pdfPath) return null;
        const filename = pdfPath.split(/[/\\]/).pop();
        return (
          <Link
            component="button"
            onClick={() => onViewPdf?.(pdfPath)}
            tabIndex={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 'inherit',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <PdfIcon sx={{ fontSize: 14, color: 'error.main' }} />
            {filename}
          </Link>
        );
      }
    });

    // Add MCDX column with clickable filename
    cols.push({
      field: 'mcdx',
      headerName: 'MCDX',
      width: 150,
      cellRenderer: (params: any) => {
        const mcdxPath = params.value;
        if (!mcdxPath) return null;
        const filename = mcdxPath.split(/[/\\]/).pop();
        return (
          <Link
            component="button"
            onClick={() => onViewMcdx?.(mcdxPath)}
            tabIndex={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 'inherit',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <McdxIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            {filename}
          </Link>
        );
      }
    });

    return cols;
  }, [inputKeys, outputKeys, onViewPdf, onViewMcdx]);

  const handleExport = useCallback(() => {
    const exportData = results
      .filter(r => r.status === 'success')
      .map((row) => ({
        Iteration: row.row + 1,
        ...row.inputs,
        ...row.data,
      }));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    exportToCsv(exportData, `batch_results_${timestamp}.csv`);
  }, [results]);

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box aria-live="polite" aria-atomic="true">
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            Results: {successCount} successful, {failedCount} failed
          </Typography>
        </Box>
        <Button
          startIcon={<DownloadIcon aria-hidden="true" />}
          onClick={handleExport}
          disabled={successCount === 0}
          variant="outlined"
          size="small"
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          Export CSV
        </Button>
      </Stack>
      <div className="ag-theme-mathcad" style={{ height: 500, width: '100%' }}>
        <AgGridReact
          rowData={results}
          columnDefs={columnDefs}
          animateRows={false}
          pagination={results.length > 10}
          paginationPageSize={50}
          theme="legacy"
        />
      </div>
    </Box>
  );
});
