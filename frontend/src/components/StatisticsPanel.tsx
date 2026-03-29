import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Divider,
  Grid,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import {
  type WorkflowStepSummary,
  type MappingChain,
} from './WorkflowSummaryView';
import { tokens } from '../theme/mui-theme';

interface StatisticsPanelProps {
  onBack: () => void;
  totalSteps: number;
  totalIterations: number;
  steps: WorkflowStepSummary[];
  mappingChains: MappingChain[];
  warnings: string[];
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  onBack,
  totalSteps,
  totalIterations,
  steps,
  mappingChains,
  warnings,
}) => {
  const totalInputs = steps.reduce((sum, step) => sum + step.inputCount, 0);
  const totalOutputs = steps.reduce((sum, step) => sum + step.outputCount, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
          onClick={onBack}
          sx={{
            color: 'primary.main',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
            p: 0,
            minWidth: 0,
          }}
        >
          Back
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mb: 3, fontWeight: 700, fontFamily: 'Lexend' }}>
        Workflow Statistics
      </Typography>

      <Stack spacing={3} sx={{ flex: 1, overflowY: 'auto' }}>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Box sx={{ p: 2, bgcolor: tokens.neutral[50], borderRadius: 2, border: '1px solid', borderColor: tokens.neutral[100] }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Steps</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.primary[700] }}>{totalSteps}</Typography>
            </Box>
          </Grid>
          <Grid size={6}>
            <Box sx={{ p: 2, bgcolor: tokens.neutral[50], borderRadius: 2, border: '1px solid', borderColor: tokens.neutral[100] }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Iterations</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.primary[700] }}>{totalIterations}</Typography>
            </Box>
          </Grid>
          <Grid size={6}>
            <Box sx={{ p: 2, bgcolor: tokens.neutral[50], borderRadius: 2, border: '1px solid', borderColor: tokens.neutral[100] }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Total Inputs</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.primary[700] }}>{totalInputs}</Typography>
            </Box>
          </Grid>
          <Grid size={6}>
            <Box sx={{ p: 2, bgcolor: tokens.neutral[50], borderRadius: 2, border: '1px solid', borderColor: tokens.neutral[100] }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Total Outputs</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.primary[700] }}>{totalOutputs}</Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.875rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Data Links
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            There are <strong>{mappingChains.length}</strong> active data links between workflow steps.
          </Typography>
          
          <Stack spacing={1}>
            {mappingChains.map((chain, idx) => (
              <Box key={idx} sx={{ p: 1, bgcolor: tokens.neutral[50], borderRadius: 1, border: '1px solid', borderColor: tokens.neutral[100] }}>
                <Typography variant="caption" sx={{ display: 'block', fontFamily: tokens.fontStack.mono, fontSize: '0.875rem' }}>
                  <Box component="span" sx={{ color: tokens.accent[600] }}>{chain.from}</Box> &rarr; <Box component="span" sx={{ color: tokens.success.dark }}>{chain.to}</Box>
                </Typography>
              </Box>
            ))}
            {mappingChains.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No active data links.
              </Typography>
            )}
          </Stack>
        </Box>

        {warnings.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.875rem', color: tokens.warning.dark, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Validation Issues ({warnings.length})
              </Typography>
              <Stack spacing={1}>
                {warnings.map((warning, idx) => (
                  <Typography key={idx} variant="caption" sx={{ color: tokens.warning.chipText, display: 'flex', gap: 1, fontSize: '0.875rem' }}>
                    • {warning}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
};

