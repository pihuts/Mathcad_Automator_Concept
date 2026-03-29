import { AgGridReact } from 'ag-grid-react'
import { useMemo } from 'react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Chip } from '@mui/material';
import type { BatchRow } from '../services/api'
import styles from './BatchGrid.module.css'

// Cache the openFile function to avoid dynamic import overhead on each click
type OpenFileFn = (path: string) => Promise<{ status: string }>;
let openFileCache: OpenFileFn | null = null;
const getOpenFile = async (): Promise<OpenFileFn> => {
  if (openFileCache) return openFileCache;
  const module = await import('../services/api');
  openFileCache = module.openFile;
  return openFileCache;
};

interface BatchGridProps {
  data: BatchRow[] | undefined;
}

interface StatusRendererParams extends ICellRendererParams<BatchRow> {
  value: string;
}

const StatusRenderer = (params: StatusRendererParams) => {
  const status = params.value;
  const stage = params.data?.stage;

  let color: 'default' | 'success' | 'primary' | 'error' | 'warning' = 'default';
  let text = status;

  if (status === 'success') color = 'success';
  if (status === 'running') {
    color = 'primary';
    if (stage) text = stage; // Show granular status
  }
  if (status === 'failed') color = 'error';
  if (status === 'pending') color = 'warning';

  return (
    <Chip
      label={text}
      color={color}
      size="small"
      variant="outlined"
      aria-label={`Status: ${text}`}
      role="status"
    />
  );
}

interface PdfRendererParams extends ICellRendererParams<BatchRow> {
  value: string | null | undefined;
}

const PdfRenderer = (params: PdfRendererParams) => {
  const pdfPath = params.value;
  if (!pdfPath) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fn = await getOpenFile();
    fn(pdfPath);
  };

  // Prefetch on hover
  const handleMouseEnter = () => {
    getOpenFile();
  };

  return (
    <Chip
      label="View PDF"
      color="primary"
      size="small"
      variant="outlined"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      aria-label={`Open PDF: ${params.value?.split(/[/\\]/).pop() ?? 'file'}`}
      role="button"
      tabIndex={0}
      sx={{
        cursor: 'pointer',
        minWidth: 44,
        minHeight: 36,
        '&:focus-visible': {
          outline: '2px solid var(--color-primary)',
          outlineOffset: '2px',
        },
      }}
    />
  );
}

export const BatchGrid = ({ data }: BatchGridProps) => {
  const useAutoHeight = data && data.length > 0 && data.length <= 10;

  const columnDefs = useMemo<ColDef[]>(() => {
    const baseCols: ColDef[] = [
      { field: 'row', headerName: 'Row', width: 80, pinned: 'left' },
      { field: 'status', headerName: 'Status', width: 200, cellRenderer: StatusRenderer, pinned: 'left' },
      {
        field: 'pdf',
        headerName: 'Export',
        width: 120,
        cellRenderer: PdfRenderer,
        pinned: 'right'
      },
    ];

    if (data && data.length > 0) {
      // Find first row that has data to extract columns
      const firstWithData = data.find(r => r.data && Object.keys(r.data).length > 0);
      if (firstWithData && firstWithData.data) {
        const outputKeys = Object.keys(firstWithData.data);
        outputKeys.forEach(key => {
          baseCols.push({
            headerName: key,
            valueGetter: (params) => params.data.data ? params.data.data[key] : '',
            flex: 1,
            minWidth: 100
          });
        });
      }
    }

    baseCols.push({
      field: 'error',
      headerName: 'Error',
      flex: 2,
      minWidth: 200,
      wrapText: true,
      autoHeight: true,
      cellStyle: { whiteSpace: 'normal', color: 'var(--color-error-main)' }
    });

    return baseCols;
  }, [data]);

  return (
    <div
      className={styles.gridContainer}
      role="grid"
      aria-label="Batch results table"
      aria-rowcount={data?.length ?? 0}
    >
      <div className="ag-theme-mathcad" style={{ height: useAutoHeight ? undefined : 500, width: '100%' }}>
        <AgGridReact
          rowData={data || []}
          columnDefs={columnDefs}
          animateRows={false}
          domLayout={useAutoHeight ? 'autoHeight' : undefined}
          theme="legacy"
        />
      </div>
    </div>
  )
}
