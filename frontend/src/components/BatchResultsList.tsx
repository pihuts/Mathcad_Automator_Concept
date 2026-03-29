import React, { useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Collapse,
  Button,
  Chip,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RunningIcon,
  PictureAsPdf as PdfIcon,
  Description as McdxIcon
} from '@mui/icons-material';
import { tokens } from '../theme/mui-theme';
import type { BatchRow } from '../services/api';

export interface BatchResultsListProps {
  results: BatchRow[];
  maxVisible?: number;
  onViewPdf?: (path: string) => void;
  onViewMcdx?: (path: string) => void;
}

interface ResultRowProps {
  result: BatchRow;
  onViewPdf?: (path: string) => void;
  onViewMcdx?: (path: string) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <SuccessIcon sx={{ fontSize: 16, color: 'success.main' }} />;
    case 'running':
      return <RunningIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
    case 'failed':
      return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    case 'pending':
    default:
      return <PendingIcon sx={{ fontSize: 16, color: tokens.neutral[400] }} />;
  }
};

const ResultRow: React.FC<ResultRowProps> = React.memo(({ result, onViewPdf, onViewMcdx }) => {
  const [expanded, setExpanded] = useState(false);
  const hasError = result.status === 'failed' && !!result.error;
  const hasData = result.data && Object.keys(result.data).length > 0;

  // Format data preview
  const dataPreview = result.data
    ? Object.entries(result.data)
      .slice(0, 3)
      .map(([key, val]) => `${key}: ${typeof val === 'number' ? val.toFixed(4) : val}`)
      .join(' | ')
    : '';

  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: tokens.neutral[100],
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { bgcolor: tokens.neutral[50] }
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ py: 1, px: 1.5 }}
      >
        {/* Status icon */}
        {getStatusIcon(result.status)}

        {/* Row number */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
            minWidth: 30
          }}
        >
          #{result.row}
        </Typography>

        {/* PDF link - moved to left side for visibility */}
        {result.pdf && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <PdfIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography
              component="button"
              variant="caption"
              onClick={() => onViewPdf?.(result.pdf!)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewPdf?.(result.pdf!);
                }
              }}
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                '&:hover': { textDecoration: 'underline' },
                '&:focus-visible': {
                  outline: `2px solid ${tokens.primary[700]}`,
                  outlineOffset: '2px',
                  borderRadius: tokens.radius.sm,
                },
              }}
            >
              {result.pdf.split(/[/\\]/).pop()}
            </Typography>
          </Stack>
        )}

        {/* MCDX link - moved to left side for visibility */}
        {result.mcdx && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <McdxIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography
              component="button"
              variant="caption"
              onClick={() => onViewMcdx?.(result.mcdx!)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewMcdx?.(result.mcdx!);
                }
              }}
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                '&:hover': { textDecoration: 'underline' },
                '&:focus-visible': {
                  outline: `2px solid ${tokens.primary[700]}`,
                  outlineOffset: '2px',
                  borderRadius: tokens.radius.sm,
                },
              }}
            >
              {result.mcdx.split(/[/\\]/).pop()}
            </Typography>
          </Stack>
        )}

        {/* Stage indicator (if running) */}
        {result.stage && result.status === 'running' && (
          <Chip
            label={result.stage}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 32, fontSize: '0.875rem' }}
          />
        )}

        {/* Data preview or status text */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {result.status === 'success' && dataPreview && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block'
              }}
            >
              {dataPreview}
            </Typography>
          )}
          {result.status === 'running' && (
            <Typography variant="caption" sx={{ color: 'primary.main', fontStyle: 'italic' }}>
              Running...
            </Typography>
          )}
          {result.status === 'pending' && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Waiting...
            </Typography>
          )}
          {hasError && (
            <Typography
              component="button"
              variant="caption"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: 'error.main',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                textDecoration: 'underline',
                '&:hover': { textDecoration: 'underline' },
                '&:focus-visible': {
                  outline: `2px solid ${tokens.error.main}`,
                  outlineOffset: '2px',
                  borderRadius: tokens.radius.sm,
                },
              }}
              aria-expanded={expanded}
              aria-controls={`error-details-${result.row}`}
            >
              {expanded ? 'Hide error details' : `View error details: ${result.error!.substring(0, 40)}...`}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Expanded error details */}
      <Collapse in={expanded && hasError}>
        <Box
          id={`error-details-${result.row}`}
          sx={{
            px: 2,
            pb: 1,
            ml: 5,
            bgcolor: tokens.error.light,
            borderRadius: 1,
            border: '1px solid',
            borderColor: tokens.error.border
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'error.dark',
              fontFamily: tokens.fontStack.mono,
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {result.error}
          </Typography>
        </Box>
      </Collapse>

      {/* Expanded data details */}
      <Collapse in={expanded && hasData && !hasError}>
        <Box sx={{ px: 2, pb: 1, ml: 5 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {result.data && Object.entries(result.data).map(([key, val]) => (
              <Chip
                key={key}
                label={`${key}: ${typeof val === 'number' ? val.toFixed(4) : val}`}
                size="small"
                variant="outlined"
                sx={{
                  height: 32,
                  fontSize: '0.875rem',
                  '& .MuiChip-label': { px: 0.75 }
                }}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
});

export const BatchResultsList: React.FC<BatchResultsListProps> = ({
  results,
  maxVisible = 10,
  onViewPdf,
  onViewMcdx
}) => {
  const [showAll, setShowAll] = useState(false);

  if (!results || results.length === 0) {
    return (
      <Paper
        elevation={0}
        role="status"
        aria-label="No results available"
        sx={{
          p: 3,
          bgcolor: tokens.neutral[50],
          borderRadius: 2,
          textAlign: 'center'
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          No results yet. Run an execution to see results.
        </Typography>
      </Paper>
    );
  }

  // Sort results by row number
  const sortedResults = [...results].sort((a, b) => a.row - b.row);
  const visibleResults = showAll ? sortedResults : sortedResults.slice(0, maxVisible);
  const hiddenCount = sortedResults.length - maxVisible;

  // Calculate summary stats
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const runningCount = results.filter(r => r.status === 'running').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: tokens.neutral[200],
        overflow: 'hidden'
      }}
    >
      {/* Summary header */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: tokens.neutral[50],
          borderBottom: '1px solid',
          borderColor: tokens.neutral[200]
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          RESULTS
        </Typography>
        <Box sx={{ flex: 1 }} />
        {successCount > 0 && (
          <Chip
            icon={<SuccessIcon sx={{ fontSize: 14 }} />}
            label={successCount}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 32, fontSize: '0.875rem' }}
          />
        )}
        {failedCount > 0 && (
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 14 }} />}
            label={failedCount}
            size="small"
            color="error"
            variant="outlined"
            sx={{ height: 32, fontSize: '0.875rem' }}
          />
        )}
        {runningCount > 0 && (
          <Chip
            icon={<RunningIcon sx={{ fontSize: 14 }} />}
            label={runningCount}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 32, fontSize: '0.875rem' }}
          />
        )}
        {pendingCount > 0 && (
          <Chip
            icon={<PendingIcon sx={{ fontSize: 14 }} />}
            label={pendingCount}
            size="small"
            variant="outlined"
            sx={{ height: 32, fontSize: '0.875rem' }}
          />
        )}
      </Stack>

      {/* Results list */}
      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
        {visibleResults.map((result) => (
          <ResultRow
            key={result.row}
            result={result}
            onViewPdf={onViewPdf}
            onViewMcdx={onViewMcdx}
          />
        ))}
      </Box>

      {/* Show more/less button */}
      {hiddenCount > 0 && !showAll && (
        <Box sx={{ p: 1, textAlign: 'center', bgcolor: tokens.neutral[50] }}>
          <Button
            size="small"
            onClick={() => setShowAll(true)}
            sx={{ fontSize: '0.875rem', textTransform: 'none' }}
          >
            Show {hiddenCount} more results
          </Button>
        </Box>
      )}

      {showAll && results.length > maxVisible && (
        <Box sx={{ p: 1, textAlign: 'center', bgcolor: tokens.neutral[50] }}>
          <Button
            size="small"
            onClick={() => setShowAll(false)}
            sx={{ fontSize: '0.875rem', textTransform: 'none' }}
          >
            Show less
          </Button>
        </Box>
      )}
    </Paper>
  );
};

