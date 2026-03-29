import { useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Box,
  Stack,
  CircularProgress
} from '@mui/material'
import {
  PlayArrow as PlayArrowIcon,
  Close as CloseIcon,
  List as ListIcon,
  Timer as TimerIcon
} from '@mui/icons-material'
import {
  calculateIterationCount,
  generateIterations,
  type MultiValueInput,
  type BatchMode
} from '../utils/batchIteration'
import { tokens } from '../theme/mui-theme'

export interface BatchPreviewModalProps {
  open: boolean
  onClose: () => void
  onRun: () => void
  mode: BatchMode
  inputs: MultiValueInput[] // Each input now has its own caseTransform
  isValid: boolean
  validationError?: string
  isStarting?: boolean
}

/**
 * BatchPreviewModal - Preview dialog before batch execution
 *
 * Shows execution details including:
 * - Iteration mode (Combination/Zip)
 * - Total execution count
 * - First 10 sample iterations
 * - Time estimate
 * - Validation errors if any
 */
export function BatchPreviewModal({
  open,
  onClose,
  onRun,
  mode,
  inputs,
  isValid,
  validationError,
  isStarting = false
}: BatchPreviewModalProps) {
  // Calculate iteration count (caseTransform is now per-input in inputs)
  const iterationCount = useMemo(() => {
    return calculateIterationCount(inputs, mode)
  }, [inputs, mode])

  // Generate sample iterations (first 10)
  const sampleIterations = useMemo(() => {
    if (!isValid) return []
    const allIterations = generateIterations(inputs, mode)
    return allIterations.slice(0, 10)
  }, [inputs, mode, isValid])

  // Calculate time estimate (5 seconds per iteration heuristic)
  const timeEstimate = useMemo(() => {
    const totalSeconds = iterationCount * 5
    if (totalSeconds < 60) {
      return `~${totalSeconds} seconds`
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `~${minutes} min ${seconds} sec`
    } else {
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      return `~${hours} hr ${minutes} min`
    }
  }, [iterationCount])

  // Get input aliases for table columns
  const inputAliases = useMemo(() => {
    return inputs.map(input => input.alias)
  }, [inputs])

  // Get mode label
  const modeLabel = mode === 'combination' ? 'Combination Mode' : 'Zip Mode'
  const modeDescription = mode === 'combination'
    ? 'All permutations of input values'
    : 'Values paired by row index'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: tokens.radius.xl }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ListIcon color="primary" />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            Batch Execution Preview
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          {/* Mode and Count Display */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={modeLabel}
              color="primary"
              variant="outlined"
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {modeDescription}
            </Typography>
          </Stack>

          {/* Execution Count */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: tokens.surface.canvas }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Total Executions:
              </Typography>
              <Typography variant="h5" color="primary" fontWeight="bold">
                {iterationCount.toLocaleString()}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Stack direction="row" spacing={0.5} alignItems="center">
                <TimerIcon fontSize="small" color="action" aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  {timeEstimate} estimated
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Validation Error Alert */}
          {!isValid && validationError && (
            <Alert severity="error">
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Cannot run batch execution
              </Typography>
              {validationError}
            </Alert>
          )}

          {/* Sample Iterations Table */}
          {isValid && sampleIterations.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Sample Iterations (first {Math.min(10, iterationCount)} of {iterationCount}):
              </Typography>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: 300 }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          bgcolor: tokens.surface.canvas,
                          fontWeight: 'bold',
                          width: 60
                        }}
                      >
                        #
                      </TableCell>
                      {inputAliases.map(alias => (
                        <TableCell
                          key={alias}
                          sx={{
                            bgcolor: tokens.surface.canvas,
                            fontWeight: 'bold',
                            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace"
                          }}
                        >
                          {alias}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sampleIterations.map((iteration, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{index + 1}</TableCell>
                        {inputAliases.map(alias => (
                          <TableCell
                            key={alias}
                            sx={{ fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace", fontSize: '0.85rem' }}
                          >
                            {formatValue(iteration[alias])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {iterationCount > 10 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                >
                  ... and {(iterationCount - 10).toLocaleString()} more iterations
                </Typography>
              )}
            </Box>
          )}

          {/* Empty state */}
          {isValid && sampleIterations.length === 0 && (
            <Alert severity="info">
              No iterations to preview. Check your input configuration.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon />}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onRun}
          startIcon={isStarting ? <CircularProgress size={24} color="inherit" /> : <PlayArrowIcon />}
          variant="contained"
          disabled={!isValid || isStarting}
          color="primary"
        >
          {isStarting ? 'Starting...' : 'Run Batch'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Format a value for display in the preview table
 */
function formatValue(value: any): string {
  if (value === undefined || value === null) {
    return '-'
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'object') {
    // Handle { value, units } format
    if (value.value !== undefined && value.units) {
      return `${value.value} ${value.units}`
    }
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    // Format numbers with reasonable precision
    return Number.isInteger(value) ? value.toString() : value.toFixed(4)
  }
  return String(value)
}
