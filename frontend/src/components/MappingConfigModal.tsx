import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Autocomplete,
} from '@mui/material';
import { IconLink } from '@tabler/icons-react';
import { InputConfigView } from './InputConfigView';
import type { InputConfig } from '../services/api';

export interface MappingConfigModalProps {
  open: boolean;
  onClose: () => void;
  inputAlias: string;
  inputName: string;
  inputType: 'numeric' | 'string';
  stepPosition: number;
  upstreamOutputs: Array<{ value: string; label: string; group: string }>;
  currentMapping?: { sourceFile: string; sourceAlias: string; sourceType?: 'input' | 'output'; units?: string };
  autoMappingDisabled?: boolean;
  onReenableAutoMapping?: () => void;
  currentValue?: InputConfig;
  onMappingChange: (mapping: { sourceFile: string; sourceAlias: string; sourceType?: 'input' | 'output'; units?: string } | null) => void;
  csvColumnsGrouped?: Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  onCsvColumnSelect?: (fileId: string, column: string) => void;
}

type ConfigMode = 'mapping' | 'manual';

export const MappingConfigModal = ({
  open,
  onClose,
  inputAlias,
  inputName,
  inputType,
  stepPosition,
  upstreamOutputs = [],
  currentMapping,
  autoMappingDisabled = false,
  onReenableAutoMapping,
  currentValue,
  onMappingChange,
  csvColumnsGrouped = [],
  onCsvColumnSelect,
}: MappingConfigModalProps) => {
  const [configMode, setConfigMode] = useState<ConfigMode>(
    currentMapping ? 'mapping' : 'manual'
  );

  // Reset mode when modal opens
  useEffect(() => {
    if (open) {
      setConfigMode(currentMapping ? 'mapping' : 'manual');
    }
  }, [open, currentMapping]);

  const handleModeChange = (_: React.MouseEvent, value: ConfigMode) => {
    if (value !== null) {
      setConfigMode(value);
      if (value === 'mapping' && !currentMapping) {
        onMappingChange(null);
      }
    }
  };

  const handleMappingChange = (mapping: { sourceFile: string; sourceAlias: string; sourceType?: 'input' | 'output'; units?: string } | null) => {
    onMappingChange(mapping);
  };

  const handleSave = () => {
    onClose();
  };

  const handleClearMapping = () => {
    onMappingChange(null);
  };

  const selectedMappingValue = currentMapping
    ? `${currentMapping.sourceFile}|${currentMapping.sourceAlias}|${currentMapping.sourceType ?? 'output'}`
    : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
        Configure Input: {inputAlias}
      </DialogTitle>
      <DialogContent sx={{ minWidth: 400 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {inputName} - Step {stepPosition + 1}
          </Typography>

          {/* Mode Selection */}
          <ToggleButtonGroup
            value={configMode}
            exclusive
            onChange={handleModeChange}
            color="primary"
            size="small"
            sx={{ mt: 1 }}
          >
            <ToggleButton value="mapping" disabled={upstreamOutputs.length === 0}>
              <IconLink size={16} style={{ marginRight: 4 }} />
              Map from Upstream
            </ToggleButton>
            <ToggleButton value="manual">
              Manual Value
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Mapping Mode */}
          {configMode === 'mapping' && (
            <Stack spacing={2}>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Select an output from a previous step to use as the input value.
              </Typography>
              <Autocomplete
                autoFocus
                options={upstreamOutputs}
                groupBy={(option) => option.group}
                getOptionLabel={(option) => option.label}
                value={upstreamOutputs.find((option) => option.value === selectedMappingValue) || null}
                onChange={(_, newValue) => {
                  if (newValue) {
                    const [sourceFile, sourceAlias, sourceType] = newValue.value.split('|');
                    handleMappingChange({
                      sourceFile,
                      sourceAlias,
                      sourceType: sourceType === 'input' ? 'input' : 'output',
                      units: currentMapping?.units,  // Preserve existing units when changing mapping source
                    });
                  } else {
                    handleMappingChange(null);
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Select upstream output" size="small" />
                )}
                disabled={upstreamOutputs.length === 0}
                fullWidth
              />
              {currentMapping && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={handleClearMapping}
                >
                  Clear Mapping
                </Button>
              )}
              {autoMappingDisabled && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Auto-mapping disabled for this input.
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => onReenableAutoMapping?.()}
                  >
                    Re-enable Auto
                  </Button>
                </Stack>
              )}
              {upstreamOutputs.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No upstream outputs available. Add steps before this one to enable mapping.
                </Typography>
              )}
            </Stack>
          )}

          {/* Manual Value Mode */}
          {configMode === 'manual' && (
            <InputConfigView
              inputAlias={inputAlias}
              inputName={inputName}
              inputType={inputType}
              stepPosition={stepPosition}
              upstreamOutputs={upstreamOutputs}
              currentMapping={currentMapping}
              currentValue={currentValue}
              onMappingChange={handleMappingChange}
              csvColumnsGrouped={csvColumnsGrouped}
              onCsvColumnSelect={onCsvColumnSelect}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
            Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
