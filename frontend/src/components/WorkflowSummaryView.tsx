import {
  Stack,
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import iStyles from '../styles/industrial.module.css';
import { tokens } from '../theme/mui-theme';

export interface WorkflowStepSummary {
  index: number;
  fileName: string;
  inputCount: number;
  outputCount: number;
  type: 'calculation';
}

export interface MappingChain {
  from: string;
  to: string;
  via: string;
}

export interface WorkflowSummaryViewProps {
  totalSteps: number;
  totalIterations: number;
  steps: WorkflowStepSummary[];
  mappingChains: MappingChain[];
  exportFormats: { pdf: boolean; mcdx: boolean };
  warnings: string[];
}

export const WorkflowSummaryView = ({
  totalSteps,
  totalIterations,
  steps,
  mappingChains,
  exportFormats,
  warnings,
}: WorkflowSummaryViewProps) => {
  return (
    <Stack spacing={3}>
      {/* Stats Section */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap' }}>
        <Paper className={iStyles.card} sx={{ p: 2, flex: 1 }}>
          <Stack spacing={0} alignItems="center">
            <Typography variant="caption" color="text.secondary" className={iStyles.techLabel}>TOTAL STEPS</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{totalSteps}</Typography>
          </Stack>
        </Paper>
        <Paper className={iStyles.card} sx={{ p: 2, flex: 1 }}>
          <Stack spacing={0} alignItems="center">
            <Typography variant="caption" color="text.secondary" className={iStyles.techLabel}>ITERATIONS</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{totalIterations}</Typography>
          </Stack>
        </Paper>
        <Paper className={iStyles.card} sx={{ p: 2, flex: 1 }}>
          <Stack spacing={0} alignItems="center">
            <Typography variant="caption" color="text.secondary" className={iStyles.techLabel}>EXPORT</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {exportFormats.pdf && <Chip label="PDF" size="small" color="primary" />}
              {exportFormats.mcdx && <Chip label="MCDX" size="small" color="info" />}
              {!exportFormats.pdf && !exportFormats.mcdx && (
                <Chip label="None" size="small" color="default" />
              )}
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Step Overview */}
      <Stack spacing={1}>
        <Typography className={iStyles.techLabel}>STEPS</Typography>
        <Stack spacing={0.5}>
          {steps.map((step) => (
            <Paper
              key={step.index}
              className={iStyles.card}
              sx={{ p: 1, backgroundColor: 'transparent' }}
            >
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FileIcon sx={{ fontSize: 16, color: tokens.accent[500] }} />
                  <Stack spacing={0}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Step {step.index}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={step.fileName}
                    >
                      {step.fileName}
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip label={`${step.inputCount} in`} size="small" variant="outlined" color="primary" />
                  <Chip label={`${step.outputCount} out`} size="small" variant="outlined" color="info" />
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      </Stack>

      {/* Data Flow */}
      {mappingChains.length > 0 && (
        <Stack spacing={1}>
          <Typography className={iStyles.techLabel}>DATA FLOW</Typography>
          <Stack spacing={0.5}>
            {mappingChains.map((chain, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontFamily: tokens.fontStack.mono, color: 'primary.main' }}>
                  {chain.from}
                </Typography>
                <ArrowForwardIcon sx={{ fontSize: 14, color: tokens.neutral[500] }} />
                <Typography variant="caption" sx={{ fontFamily: tokens.fontStack.mono, color: 'info.main' }}>
                  {chain.to}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  via {chain.via}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <>
          <Divider />
          <Alert severity="warning" icon={<WarningIcon sx={{ fontSize: 16 }} />}>
            <Stack spacing={0.5}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Validation Warnings</Typography>
              {warnings.map((warning, idx) => (
                <Typography key={idx} variant="caption" color="warning.main">
                  • {warning}
                </Typography>
              ))}
            </Stack>
          </Alert>
        </>
      )}
    </Stack>
  );
};
