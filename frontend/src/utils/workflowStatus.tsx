/**
 * Shared workflow step status utilities.
 * Single source of truth for status colors, tones, and icons.
 */
import { Box } from '@mui/material';
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconLock,
  IconClock,
  IconLoader,
  IconCalculator,
} from '@tabler/icons-react';
import type { StepStatusType } from '../services/api';
import { tokens } from '../theme/mui-theme';

export interface StatusTone {
  bg: string;
  border: string;
  text: string;
  label: string;
}

/** Returns full tone object for status (bg, border, text, label). */
export const getStatusTone = (status?: StepStatusType): StatusTone => {
  switch (status) {
    case 'completed':
      return {
        bg: tokens.success.light,
        border: tokens.success.border,
        text: tokens.success.dark,
        label: 'Completed',
      };
    case 'failed':
      return {
        bg: tokens.error.light,
        border: tokens.error.border,
        text: tokens.error.dark,
        label: 'Failed',
      };
    case 'skipped':
      return {
        bg: tokens.warning.light,
        border: tokens.warning.border,
        text: tokens.warning.dark,
        label: 'Skipped',
      };
    case 'blocked':
      return {
        bg: tokens.neutral[100],
        border: tokens.neutral[300],
        text: tokens.neutral[700],
        label: 'Blocked',
      };
    case 'running':
      return {
        bg: tokens.primary[50],
        border: tokens.primary[200],
        text: tokens.primary[800],
        label: 'Running',
      };
    default:
      return {
        bg: tokens.neutral[50],
        border: tokens.neutral[200],
        text: tokens.neutral[700],
        label: 'Draft',
      };
  }
};

/** Returns only the background color for a status. */
export const getStatusColor = (status?: StepStatusType): string => {
  return getStatusTone(status).bg;
};

/** Returns a JSX status icon for the given status. size=18 for WorkflowCanvas, size=16 for WorkflowBuilder. */
export const StatusIcon = ({ status, size = 18, className }: { status: StepStatusType; size?: number; className?: string }) => {
  switch (status) {
    case 'completed':
      return <IconCircleCheck size={size} style={{ color: tokens.success.main }} />;
    case 'failed':
      return <IconCircleX size={size} style={{ color: tokens.error.main }} />;
    case 'skipped':
      return <IconAlertTriangle size={size} style={{ color: tokens.warning.main }} />;
    case 'blocked':
      return <IconLock size={size} style={{ color: tokens.neutral[500] }} />;
    case 'running':
      return (
        <Box className={className}>
          <IconLoader size={size} style={{ color: tokens.primary[700] }} />
        </Box>
      );
    case 'pending':
      return <IconClock size={size} style={{ color: tokens.neutral[500] }} />;
    default:
      return null;
  }
};

/** Running calculator icon for WorkflowBuilder (uses accent color and calculator icon). */
export const RunningCalculatorIcon = ({ size = 16 }: { size?: number }) => (
  <Box className="icon-spin">
    <IconCalculator size={size} style={{ color: tokens.accent[500] }} />
  </Box>
);

/**
 * Returns the appropriate status icon JSX for a given status.
 * @param status - The step status
 * @param size - Icon size in pixels (default 18)
 * @param useCalculatorForRunning - Use calculator icon instead of loader for running status (default false)
 */
export const getStatusIcon = (
  status: StepStatusType,
  size = 18,
  useCalculatorForRunning = false
) => {
  if (status === 'running' && useCalculatorForRunning) {
    return <RunningCalculatorIcon size={size} />;
  }
  if (status === 'running') {
    return <StatusIcon status={status} size={size} />;
  }
  return <StatusIcon status={status} size={size} />;
};
