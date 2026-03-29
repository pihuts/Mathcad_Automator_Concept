import { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Box,
  Autocomplete,
} from '@mui/material';
import { tokens } from '../theme/mui-theme';
import { UNIT_PRESETS } from '../constants/units';
import type { InputConfig } from '../services/api';
import { normalizeAlias } from '../utils/workflowAutoMapping';
import iStyles from '../styles/industrial.module.css';

export interface InputConfigViewProps {
  inputAlias: string;
  inputName: string;
  inputType: 'numeric' | 'string';
  stepPosition: number;
  upstreamOutputs: Array<{ value: string; label: string; group: string }>;
  currentMapping?: { sourceFile: string; sourceAlias: string; sourceType?: 'input' | 'output'; units?: string };
  currentValue?: InputConfig;
  onMappingChange: (mapping: { sourceFile: string; sourceAlias: string; sourceType?: 'input' | 'output'; units?: string } | null) => void;
  /** Grouped CSV columns from global state */
  csvColumnsGrouped?: Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  /** Callback when CSV column is selected */
  onCsvColumnSelect?: (fileId: string, column: string) => void;
}

export const InputConfigView = ({
  inputAlias,
  inputName,
  inputType,
  upstreamOutputs = [], // Default to empty array to prevent map error
  currentMapping,
  currentValue,
  onMappingChange,
  csvColumnsGrouped = [],
  onCsvColumnSelect,
}: InputConfigViewProps) => {
  const isExperimentalInput =
    normalizeAlias(inputAlias) === normalizeAlias('experimental_input');

  // Mapping mode units state
  const [mappingUnits, setMappingUnits] = useState<string>('');

  // Update mapping units when mapping changes externally
  useEffect(() => {
    if (currentMapping?.units) {
      setMappingUnits(currentMapping.units);
    } else if (currentValue?.units) {
      setMappingUnits(currentValue.units);
    }
  }, [currentMapping, currentValue?.units]);

  const handleMappingSelect = (value: string | null) => {
    if (value) {
      const [sourceFile, sourceAlias, sourceType] = value.split('|');
      onMappingChange({
        sourceFile,
        sourceAlias,
        sourceType: sourceType === 'input' ? 'input' : 'output',
        units: mappingUnits || undefined,
      });
    } else {
      onMappingChange(null);
    }
  };

  const handleClearMapping = () => {
    setMappingUnits('');
    onMappingChange(null);
  };

  const handleMappingUnitsChange = (newUnits: string) => {
    setMappingUnits(newUnits);
    // Update the mapping with new units if a mapping is selected
    if (currentMapping) {
      onMappingChange({
        ...currentMapping,
        units: newUnits || undefined,
      });
    }
  };

  if (isExperimentalInput) {
    return (
      <Stack spacing={1.5}>
        <Typography className={iStyles.techLabel} variant="caption">
          SYSTEM INPUT
        </Typography>
        <TextField
          label="System Input Name"
          value={inputName || inputAlias}
          size="small"
          disabled
          helperText="System-controlled"
          fullWidth
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Mapping Mode - only mode available after removing manual value entry */}
      <Stack spacing={2}>
        <Typography className={iStyles.techLabel} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
          SOURCE OUTPUT
        </Typography>
        <Autocomplete
          autoFocus
          options={upstreamOutputs}
          getOptionLabel={(option) => option.label}
          value={upstreamOutputs.find((option) => option.value === (currentMapping ? `${currentMapping.sourceFile}|${currentMapping.sourceAlias}|${currentMapping.sourceType ?? 'output'}` : null)) || null}
          onChange={(_, newValue) => handleMappingSelect(newValue ? newValue.value : null)}
          aria-label="Select upstream output"
          renderInput={(params) => <TextField {...params} placeholder="Select upstream output" size="small" />}
          disabled={upstreamOutputs.length === 0}
          fullWidth
        />
        {currentMapping && (
          <Button
            variant="text"
            size="small"
            color="error"
            onClick={handleClearMapping}
            aria-label="Clear input mapping"
            sx={{
              alignSelf: 'flex-start',
              minHeight: 44,
              minWidth: 44,
              px: 1.5,
            }}
          >
            Clear mapping
          </Button>
        )}

        {/* Units for mapping mode (numeric only) */}
        {inputType === 'numeric' && currentMapping && (
          <Stack spacing={1}>
            <Typography className={iStyles.techLabel} variant="caption">TARGET UNITS</Typography>
            <Autocomplete
              options={UNIT_PRESETS}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
              value={UNIT_PRESETS.find(u => u.value === mappingUnits) || (mappingUnits ? { value: mappingUnits, label: mappingUnits } : UNIT_PRESETS[0])}
              onChange={(_, newValue) => {
                const newUnits = typeof newValue === 'string'
                  ? newValue
                  : (newValue?.value || '');
                handleMappingUnitsChange(newUnits);
              }}
              onInputChange={(_, inputValue, reason) => {
                if (reason === 'input') {
                  handleMappingUnitsChange(inputValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select or type units for target input"
                  size="small"
                  aria-label="Target units for this input"
                />
              )}
              freeSolo
              selectOnFocus
              clearOnBlur={false}
              handleHomeEndKeys
              size="small"
              isOptionEqualToValue={(option, value) => {
                if (typeof value === 'string') return option.value === value;
                return option.value === value?.value;
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Units to use when setting this value in Mathcad (e.g., convert incoming value to "in" before setting)
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* CSV column selection - hidden when upstream mapping is active */}
      {!currentMapping && csvColumnsGrouped && csvColumnsGrouped.length > 0 && (
        <Stack spacing={1}>
          <Typography className={iStyles.techLabel} variant="caption">SELECT COLUMN</Typography>
          <Autocomplete
            options={csvColumnsGrouped.flatMap(g =>
              g.columns.map(c => ({ ...c, group: g.group }))
            )}
            groupBy={(option) => option.group}
            getOptionLabel={(option) => option.label}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Stack spacing={0}>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: tokens.fontStack.mono, fontSize: tokens.fontSize.xs }}>
                      {option.preview.slice(0, 3).join(', ')}{option.preview.length > 3 ? '...' : ''}
                    </Typography>
                  </Stack>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Select column from uploaded CSV" size="small" aria-label="Select CSV column" />
            )}
            onChange={(_, newValue) => {
              if (newValue) {
                // Extract fileId and column from value (format: "fileId|columnName")
                const [fileId, column] = newValue.value.split('|');
                onCsvColumnSelect?.(fileId, column);
              }
            }}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            Column values will be loaded from the selected CSV during execution
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

