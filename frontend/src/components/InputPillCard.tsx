import React, { useState, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Box,
  Chip,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Typography,
  InputAdornment,
  FormControl,
  Paper,
  Button,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Add as AddIcon,
  TableChart as CsvIcon,
  Settings as SettingsIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import { getUnitDisplay } from '../constants/unitLabels';
import { tokens } from '../theme/mui-theme';

export interface CsvSource {
  fileId: string;
  column: string;
  fileName?: string;
}

export interface InputPillCardProps {
  alias: string;
  displayName: string;
  type: 'number' | 'string';
  values: (string | number)[];
  units?: string;
  unitOptions?: string[];
  csvSource?: CsvSource;
  onChange: (values: any[]) => void;
  onUnitChange?: (unit: string) => void;
  onOpenConfig?: () => void;
  onCsvUnlink?: () => void;
  onUnlock?: () => void;
  maxVisibleValues?: number;
  /** When true, the input is locked (mapped to upstream) and value editing is disabled */
  locked?: boolean;
  /** When true, this is a system-controlled input (e.g., experimental_input) */
  isSystemInput?: boolean;
}

const numericTokenPattern = /^[+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?$/i;

const isNumericToken = (value: string): boolean => numericTokenPattern.test(value.trim());

const parseInputText = (
  text: string,
  typeHint: 'number' | 'string',
): { values: (string | number)[]; valueType: 'number' | 'string' | null } => {
  const trimmed = text.trim();
  if (!trimmed) return { values: [], valueType: null };

  if (typeHint === 'string') {
    const values = trimmed.includes(',')
      ? trimmed.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
      : [trimmed];
    return { values, valueType: 'string' };
  }

  const rangeMatch = trimmed.match(
    /^([+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?)\.\.([+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?)\.\.([+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?)$/i,
  );
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = Number(rangeMatch[3]);

    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) {
      return { values: [trimmed], valueType: 'string' };
    }

    const result: number[] = [];
    if (start <= end) {
      for (let v = start; v <= end + 0.0001; v += step) {
        result.push(Math.round(v * 10000) / 10000);
      }
    } else {
      for (let v = start; v >= end - 0.0001; v -= step) {
        result.push(Math.round(v * 10000) / 10000);
      }
    }
    return { values: result, valueType: 'number' };
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
    if (parts.length > 0 && parts.every(isNumericToken)) {
      return { values: parts.map((v) => Number(v)), valueType: 'number' };
    }
    return { values: parts, valueType: 'string' };
  }

  if (isNumericToken(trimmed)) {
    return { values: [Number(trimmed)], valueType: 'number' };
  }

  return { values: [trimmed], valueType: 'string' };
};

export const InputPillCard: React.FC<InputPillCardProps> = ({
  alias,
  displayName,
  type,
  values,
  units,
  unitOptions = [],
  csvSource,
  onChange,
  onUnitChange,
  onOpenConfig,
  onCsvUnlink,
  onUnlock,
  maxVisibleValues = 3,
  locked = false,
  isSystemInput = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [_isFocused, setIsFocused] = useState(false);

  const handleAddValues = useCallback(() => {
    if (locked) return;
    const { values: newValues, valueType } = parseInputText(inputValue, type);
    if (newValues.length > 0 && valueType) {
      const existingType = values.length > 0 ? typeof values[0] : null;
      const nextValues = existingType && existingType !== valueType ? newValues : [...values, ...newValues];
      onChange(nextValues);
      setInputValue('');
    }
  }, [inputValue, type, values, onChange, locked]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddValues();
    }
  };

  const handleRemoveValue = (index: number) => {
    if (locked) return;
    const next = [...values];
    next.splice(index, 1);
    onChange(next);
  };

  const handleUnitChange = (e: SelectChangeEvent<string>) => {
    if (locked) return;
    onUnitChange?.(e.target.value);
  };

  const visibleValues = values.slice(0, maxVisibleValues);
  const hiddenCount = values.length - maxVisibleValues;
  const unitDisplay = getUnitDisplay(units);
  const systemPalette = isSystemInput
    ? {
      cardBg: tokens.warning.light,
      cardBorder: tokens.warning.border,
      title: tokens.warning.dark,
      subtitle: tokens.warning.dark,
      chipBg: tokens.warning.hoverLight,
      chipText: tokens.warning.dark,
      unitBadgeBg: tokens.warning.dark,
      unitBadgeText: tokens.neutral[0],
    }
    : {
      cardBg: tokens.surface.paper,
      cardBorder: tokens.neutral[200],
      title: tokens.primary[700],
      subtitle: tokens.primary[500],
      chipBg: tokens.primary[100],
      chipText: tokens.primary[800],
      unitBadgeBg: tokens.primary[700],
      unitBadgeText: tokens.neutral[0],
    };

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (onOpenConfig && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onOpenConfig();
    }
  }, [onOpenConfig]);

  return (
    <Paper
      elevation={0}
      onClick={onOpenConfig}
      onKeyDown={handleCardKeyDown}
      tabIndex={onOpenConfig ? 0 : undefined}
      role={onOpenConfig ? 'button' : undefined}
      aria-label={onOpenConfig ? `Configure ${displayName || alias} input` : undefined}
      sx={{
        backgroundColor: systemPalette.cardBg,
        borderRadius: tokens.radius.lg,
        p: 2,
        cursor: 'pointer',
        position: 'relative',
        boxShadow: tokens.shadow.sm,
        border: `1px solid`,
        borderColor: systemPalette.cardBorder,
        transition: tokens.transition.fast,
        '&:hover': {
          borderColor: isSystemInput ? tokens.warning.main : tokens.primary[400],
          boxShadow: tokens.shadow.md,
        },
        '&:focus-visible': {
          outline: `2px solid ${isSystemInput ? tokens.warning.dark : tokens.primary[700]}`,
          outlineOffset: '2px',
          borderColor: isSystemInput ? tokens.warning.main : tokens.primary[400],
        },
      }}
    >
      {type === 'number' && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: systemPalette.unitBadgeBg,
            color: systemPalette.unitBadgeText,
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
            {unitDisplay.short}
          </Typography>
          <Typography component="span" sx={{ opacity: 0.82, fontSize: tokens.fontSize.xs, color: 'inherit' }}>
            {unitDisplay.full}
          </Typography>
        </Box>
      )}

      <Typography sx={{ fontWeight: 900, fontSize: tokens.fontSize['2xl'], lineHeight: 1.05, color: systemPalette.title, mb: 0.4, pr: 10 }}>
        {alias}
      </Typography>

      <Typography sx={{ fontSize: tokens.fontSize.xs, color: systemPalette.subtitle, mb: 1.5, fontWeight: 700 }}>
        {displayName} · {values.length} val{values.length !== 1 ? 's' : ''}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', minHeight: 28 }}>
        {visibleValues.map((val, index) => (
          <Chip
            key={index}
            label={type === 'number' ? (typeof val === 'number' ? val.toFixed(2) : val) : val}
            size="small"
            aria-label={`Remove ${type === 'number' && typeof val === 'number' ? val.toFixed(2) : val} from ${alias}`}
            onDelete={locked ? undefined : (e) => {
              e.stopPropagation();
              handleRemoveValue(index);
            }}
            onClick={(e) => e.stopPropagation()}
            sx={{
              minHeight: 36,
              background: systemPalette.chipBg,
              color: systemPalette.chipText,
              fontWeight: 700,
              fontSize: tokens.fontSize.xs,
              borderRadius: tokens.radius.md,
              padding: '0 8px',
              '& .MuiChip-deleteIcon': {
                fontSize: 18,
                color: systemPalette.chipText,
                opacity: locked ? 0.3 : 0.5,
                cursor: locked ? 'default' : 'pointer',
                '&:hover': { opacity: locked ? 0.3 : 1, color: systemPalette.chipText },
              },
            }}
          />
        ))}

        {csvSource && (
          <Chip
            icon={<CsvIcon sx={{ fontSize: 14 }} />}
            label={csvSource.column}
            size="small"
            aria-label={`Unlink CSV column ${csvSource.column} from ${alias}`}
            onDelete={locked ? undefined : (e) => {
              e.stopPropagation();
              onCsvUnlink?.();
            }}
            onClick={(e) => e.stopPropagation()}
            sx={{
              minHeight: 36,
              background: tokens.success.light,
              color: tokens.success.dark,
              fontWeight: 700,
              fontSize: tokens.fontSize.xs,
              borderRadius: tokens.radius.md,
              padding: '0 8px',
              '& .MuiChip-deleteIcon': {
                fontSize: 18,
                color: tokens.success.main,
                opacity: locked ? 0.3 : 0.5,
                cursor: locked ? 'default' : 'pointer',
                '&:hover': { opacity: locked ? 0.3 : 1, color: tokens.success.dark },
              },
            }}
          />
        )}

        {hiddenCount > 0 && (
          <Typography sx={{ fontSize: tokens.fontSize.xs, color: systemPalette.subtitle, fontWeight: 700 }}>
            +{hiddenCount} more
          </Typography>
        )}

        {values.length === 0 && !csvSource && !locked && (
          <Typography sx={{ fontSize: tokens.fontSize.xs, color: systemPalette.subtitle, fontStyle: 'italic', fontWeight: 600 }}>
            add a value
          </Typography>
        )}

        {values.length === 0 && !csvSource && locked && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: tokens.fontSize.xs, color: systemPalette.subtitle, fontStyle: 'italic', fontWeight: 600 }}>
              {isSystemInput ? 'System-controlled' : 'mapped to upstream'}
            </Typography>
            {onUnlock && !isSystemInput && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlock();
                }}
                sx={{
                  minWidth: 0,
                  py: 0.25,
                  px: 1,
                  fontSize: tokens.fontSize.xs,
                  borderRadius: tokens.radius.md,
                  borderColor: tokens.error.main,
                  color: tokens.error.main,
                  '&:hover': {
                    borderColor: tokens.error.dark,
                    background: tokens.error.light,
                  },
                }}
                startIcon={<LockOpenIcon sx={{ fontSize: 12 }} />}
              >
                Clear
              </Button>
            )}
          </Box>
        )}
      </Box>

      {!csvSource && !locked && (
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <TextField
            size="small"
            placeholder="Add value..."
            aria-label={`Add value to ${displayName || alias}`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              handleAddValues();
            }}
            disabled={locked}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                minHeight: 46,
                fontSize: tokens.fontSize.sm,
                borderRadius: tokens.radius.lg,
                backgroundColor: tokens.neutral[0],
                '& fieldset': { borderColor: tokens.primary[200] },
                '&:hover fieldset': { borderColor: tokens.primary[400] },
                '&.Mui-focused fieldset': { borderColor: tokens.primary[600] },
              },
              '& .MuiInputBase-input': { py: 1.1 },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleAddValues}
                    aria-label={`Add value to ${displayName || alias}`}
                    sx={{ p: 0.75, color: tokens.primary[700], minWidth: 44, minHeight: 44 }}
                    disabled={!inputValue.trim()}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {type === 'number' && unitOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 78 }}>
              <Select
                value={units || ''}
                onChange={handleUnitChange}
                displayEmpty
                aria-label={`Unit for ${alias}`}
                sx={{
                  minHeight: 46,
                  fontSize: tokens.fontSize.sm,
                  borderRadius: tokens.radius.lg,
                  backgroundColor: tokens.neutral[0],
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary[200] },
                  '& .MuiSelect-select': { py: 1.1, px: 1.25 },
                }}
                renderValue={(value) => value || '-'}
              >
                <MenuItem value="" sx={{ fontSize: tokens.fontSize.sm }}>
                  <em>Default</em>
                </MenuItem>
                {unitOptions.map((unit) => (
                  <MenuItem key={unit} value={unit} sx={{ fontSize: tokens.fontSize.sm }}>
                    {unit}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip title="Open range, list, or CSV setup">
            <IconButton
              size="small"
              aria-label="Configure input: open range, list, or CSV setup"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConfig?.();
              }}
              sx={{
                p: 1,
                color: tokens.primary[500],
                minWidth: 44,
                minHeight: 44,
                '&:hover': {
                  color: tokens.primary[700],
                  bgcolor: tokens.primary[100],
                },
              }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Paper>
  );
};

