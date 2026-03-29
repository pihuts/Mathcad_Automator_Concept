import React from 'react';
import {
  Box,
  Typography,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Divider,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

interface FailureModePanelProps {
  onBack: () => void;
  failureMode: string;
  onFailureModeChange: (mode: string) => void;
  pauseMode: string;
  onPauseModeChange: (mode: string) => void;
  iterationMode: 'combination' | 'zip';
  onIterationModeChange: (mode: 'combination' | 'zip') => void;
}

export const FailureModePanel: React.FC<FailureModePanelProps> = ({
  onBack,
  failureMode,
  onFailureModeChange,
  pauseMode,
  onPauseModeChange,
  iterationMode,
  onIterationModeChange,
}) => {
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
        Execution Settings
      </Typography>

      <Stack spacing={4}>
        <FormControl component="fieldset">
          <FormLabel
            component="legend"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 1.5,
              fontSize: '0.875rem'
            }}
          >
            Iteration Mode
          </FormLabel>
          <RadioGroup
            value={iterationMode}
            onChange={(e) => onIterationModeChange(e.target.value as 'combination' | 'zip')}
          >
            <Stack spacing={1}>
              <FormControlLabel
                value="combination"
                control={<Radio size="small" />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Combination</Typography>
                    <Typography variant="caption" color="text.secondary">All permutations of multi-value step inputs.</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="zip"
                control={<Radio size="small" />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Zip (pair by row)</Typography>
                    <Typography variant="caption" color="text.secondary">Pairs multi-value inputs by index within each step.</Typography>
                  </Box>
                }
              />
            </Stack>
          </RadioGroup>
        </FormControl>

        <Divider />

        <FormControl component="fieldset">
          <FormLabel 
            component="legend" 
            sx={{ 
              fontWeight: 600, 
              color: 'text.primary', 
              mb: 1.5,
              fontSize: '0.875rem' 
            }}
          >
            Failure Behavior
          </FormLabel>
          <RadioGroup
            value={failureMode}
            onChange={(e) => onFailureModeChange(e.target.value)}
          >
            <Stack spacing={1}>
              <FormControlLabel 
                value="stop_on_error" 
                control={<Radio size="small" />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Stop on Error</Typography>
                    <Typography variant="caption" color="text.secondary">Execution halts immediately if any step fails.</Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="continue_on_error" 
                control={<Radio size="small" />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Continue on Error</Typography>
                    <Typography variant="caption" color="text.secondary">Attempts to finish the workflow regardless of individual step failures.</Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="retry" 
                control={<Radio size="small" />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Retry (Automatic)</Typography>
                    <Typography variant="caption" color="text.secondary">Automatically retries failed steps up to 3 times.</Typography>
                  </Box>
                }
              />
            </Stack>
          </RadioGroup>
        </FormControl>

        <Divider />

        <FormControl component="fieldset">
          <FormLabel 
            component="legend" 
            sx={{ 
              fontWeight: 600, 
              color: 'text.primary', 
              mb: 1.5,
              fontSize: '0.875rem' 
            }}
          >
            Pause Behavior
          </FormLabel>
          <RadioGroup
            value={pauseMode}
            onChange={(e) => onPauseModeChange(e.target.value)}
          >
            <Stack spacing={1}>
              <FormControlLabel 
                value="auto_run" 
                control={<Radio size="small" />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Automatic (Full Speed)</Typography>
                    <Typography variant="caption" color="text.secondary">Runs all steps sequentially without stopping.</Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="pause_after_step" 
                control={<Radio size="small" />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Pause After Each Step</Typography>
                    <Typography variant="caption" color="text.secondary">Requires manual approval to proceed to the next file.</Typography>
                  </Box>
                }
              />
            </Stack>
          </RadioGroup>
        </FormControl>
      </Stack>
    </Box>
  );
};
