import { Typography, Stack, FormControl, Select, MenuItem, Chip } from '@mui/material';
import { MuiPill } from './mui/MuiPill';
import { UNIT_PRESETS } from '../constants/units';
import { tokens } from '../theme/mui-theme';

export interface OutputPillProps {
  alias: string;
  units?: string;
  onUnitChange?: (unit: string) => void;
}

export const OutputPill = ({ alias, units, onUnitChange }: OutputPillProps) => {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <MuiPill
        color="success"
        label={
          <Typography
            variant="caption"
            sx={{
              fontFamily: tokens.fontStack.mono,
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            {alias}
          </Typography>
        }
      />
      {onUnitChange && (
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={units || ''}
            onChange={(e) => onUnitChange(e.target.value)}
            displayEmpty
            size="small"
            sx={{ height: 28, fontSize: '0.75rem' }}
          >
            {UNIT_PRESETS.map((u) => (
              <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {!onUnitChange && units && (
        <Chip label={units} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
      )}
    </Stack>
  );
};
