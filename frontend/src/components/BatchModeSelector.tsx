import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { tokens } from '../theme/mui-theme';

export type BatchMode = 'combination' | 'zip';

interface BatchModeSelectorProps {
  mode: BatchMode;
  onChange: (mode: BatchMode) => void;
  disabled?: boolean;
}

export const BatchModeSelector: React.FC<BatchModeSelectorProps> = ({
  mode,
  onChange,
  disabled = false,
}) => {
  const handleChange = (_: React.MouseEvent<HTMLElement>, newMode: BatchMode | null) => {
    if (newMode !== null) {
      onChange(newMode);
    }
  };

  return (
    <Box sx={{ mb: 1.75 }}>
      <Box sx={{
        display: "flex",
        background: tokens.neutral[50],
        borderRadius: tokens.radius.md,
        p: "3px",
        border: `1px solid ${tokens.neutral[100]}`,
      }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleChange}
          fullWidth
          disabled={disabled}
          sx={{
            '& .MuiToggleButtonGroup-grouped': {
              margin: 0,
              border: 0,
              borderRadius: `${tokens.radius.sm} !important`,
              '&:not(:first-of-type)': {
                borderRadius: `${tokens.radius.sm} !important`,
              },
            },
          }}
        >
          <ToggleButton
            value="combination"
            aria-label="Combination mode: generates all permutations of input values"
            aria-pressed={mode === 'combination'}
            sx={{
              flex: 1,
              borderRadius: tokens.radius.sm,
              border: 'none',
              fontSize: 14,
              py: 1,
              textTransform: 'none',
              background: mode === 'combination' ? tokens.surface.paper : 'transparent',
              color: mode === 'combination' ? tokens.primary[700] : tokens.neutral[400],
              fontWeight: mode === 'combination' ? 600 : 400,
              boxShadow: mode === 'combination' ? tokens.shadow.sm : 'none',
              '&:hover': {
                background: mode === 'combination' ? tokens.surface.paper : tokens.primary[50],
              },
            }}
          >
            ⊞ Combination
          </ToggleButton>
          <ToggleButton
            value="zip"
            aria-label="Zip mode: pairs values by row index"
            aria-pressed={mode === 'zip'}
            sx={{
              flex: 1,
              borderRadius: tokens.radius.sm,
              border: 'none',
              fontSize: 14,
              py: 1,
              textTransform: 'none',
              background: mode === 'zip' ? tokens.surface.paper : 'transparent',
              color: mode === 'zip' ? tokens.primary[700] : tokens.neutral[400],
              fontWeight: mode === 'zip' ? 600 : 400,
              boxShadow: mode === 'zip' ? tokens.shadow.sm : 'none',
              '&:hover': {
                background: mode === 'zip' ? tokens.surface.paper : tokens.primary[50],
              },
            }}
          >
            ⇅ Zip (pair by row)
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

export default BatchModeSelector;

