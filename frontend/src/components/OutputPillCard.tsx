import React from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Paper,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { getUnitDisplay } from '../constants/unitLabels';
import { tokens } from '../theme/mui-theme';

export interface OutputPillCardProps {
  alias: string;
  displayName?: string;
  units?: string;
  unitOptions?: string[];
  onUnitChange?: (unit: string) => void;
}

/**
 * OutputPillCard: Card-style component for configuring output units.
 * Matches the visual style of InputPillCard but uses purple/indigo accent
 * to differentiate outputs from inputs.
 */
export const OutputPillCard: React.FC<OutputPillCardProps> = ({
  alias,
  displayName,
  units,
  unitOptions = [],
  onUnitChange,
}) => {
  const unitDisplay = getUnitDisplay(units);

  const handleUnitChange = (e: SelectChangeEvent<string>) => {
    onUnitChange?.(e.target.value);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: tokens.radius.lg,
        p: 2,
        position: 'relative',
        boxShadow: tokens.shadow.sm,
        border: `1px solid`,
        borderColor: 'divider',
        transition: tokens.transition.fast,
        '&:hover': {
          borderColor: tokens.accent[400],
          boxShadow: tokens.shadow.md,
        },
      }}
    >
      {/* Unit badge in top-right corner */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: tokens.accent[600],
          color: tokens.neutral[0],
          padding: '4px 12px 4px 10px',
          borderRadius: tokens.radius.sm,
          fontSize: tokens.fontSize.xs,
          fontWeight: 700,
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <Typography component="span" sx={{ fontSize: tokens.fontSize.xs, fontWeight: 800, color: 'inherit' }}>
          {unitDisplay.short || '—'}
        </Typography>
        {unitDisplay.full && (
          <Typography component="span" sx={{ opacity: 0.82, fontSize: tokens.fontSize.xs, color: 'inherit' }}>
            {unitDisplay.full}
          </Typography>
        )}
      </Box>

      {/* Title */}
      <Typography sx={{ fontWeight: 900, fontSize: tokens.fontSize['2xl'], lineHeight: 1.05, color: tokens.accent[700], mb: 0.4, pr: 10 }}>
        {alias}
      </Typography>

      {/* Subtitle */}
      <Typography sx={{ fontSize: tokens.fontSize.xs, color: tokens.accent[500], mb: 1.5, fontWeight: 700 }}>
        {displayName || alias} · Output
      </Typography>

      {/* Unit selector */}
      {unitOptions.length > 0 && (
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontSize: tokens.fontSize.xs, color: tokens.neutral[500], fontWeight: 600, minWidth: 40 }}>
            Units:
          </Typography>
          <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
            <Select
              value={units || ''}
              onChange={handleUnitChange}
              displayEmpty
              sx={{
                minHeight: 46,
                fontSize: tokens.fontSize.sm,
                borderRadius: '12px',
                backgroundColor: tokens.neutral[0],
                '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.accent[200] },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.accent[400] },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.accent[600] },
                '& .MuiSelect-select': { py: 1.1, px: 1.25 },
              }}
              renderValue={(value) => {
                if (!value) return <em style={{ color: tokens.neutral[400] }}>Unitless</em>;
                const display = getUnitDisplay(value);
                return display.full ? `${display.short} (${display.full})` : display.short;
              }}
            >
              <MenuItem value="" sx={{ fontSize: tokens.fontSize.sm }}>
                <em>Unitless (no units)</em>
              </MenuItem>
              {unitOptions.map((unit) => {
                const display = getUnitDisplay(unit);
                return (
                  <MenuItem key={unit} value={unit} sx={{ fontSize: tokens.fontSize.sm }}>
                    {display.full ? `${display.short} (${display.full})` : display.short}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* No unit options available */}
      {unitOptions.length === 0 && (
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography sx={{ fontSize: tokens.fontSize.xs, color: tokens.neutral[400], fontStyle: 'italic' }}>
            No unit options available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
