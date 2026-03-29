import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Tabs,
  Tab,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
} from '@mui/material';
import { useState, useEffect } from 'react'
import { UNIT_PRESETS } from '../constants/units'
import { getUnitDisplay } from '../constants/unitLabels'
import { parseCSV, getHeaders } from '../utils/csv_parser'
import { parseRangeInput } from '../utils/errorHandling'
import { normalizeAlias } from '../utils/workflowAutoMapping'
import type { InputConfig, StringTransform } from '../services/api'
import { tokens } from '../theme/mui-theme'

interface InputModalProps {
  opened: boolean
  onClose: () => void
  alias: string
  onSave: (config: InputConfig) => void
  /** Grouped CSV columns from global state */
  csvColumnsGrouped?: Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  /** Callback when CSV column is selected */
  onCsvColumnSelect?: (fileId: string, column: string) => void;
  /** Upstream outputs available for mapping */
  upstreamOutputs?: Array<{ value: string; label: string; group: string }>;
  /** Callback when upstream mapping is changed */
  onMappingChange?: (mapping: { sourceFile: string; sourceAlias: string; sourceType?: string; units?: string } | null) => void;
  /** Current upstream mapping if any */
  currentMapping?: { sourceFile: string; sourceAlias: string; sourceType?: string; units?: string } | null;
  /** Whether auto-mapping is currently disabled for this input */
  autoMappingDisabled?: boolean;
  /** Callback to re-enable auto-mapping */
  onReenableAutoMapping?: () => void;
  /** Existing input config to initialize from */
  initialConfig?: InputConfig;
}

const deriveRangeFromValues = (values: number[]): { start: number; end: number; step: number } | null => {
  if (values.length === 0) return null;
  if (values.length === 1) {
    return { start: values[0], end: values[0], step: 1 };
  }
  const step = values[1] - values[0];
  if (step === 0) return null;
  const epsilon = Math.max(Math.abs(step) * 1e-6, 1e-9);
  for (let i = 1; i < values.length; i++) {
    const expected = values[0] + step * i;
    if (Math.abs(values[i] - expected) > epsilon) {
      return null;
    }
  }
  return { start: values[0], end: values[values.length - 1], step };
};

export const InputModal = ({
  opened,
  onClose,
  alias,
  onSave,
  csvColumnsGrouped = [],
  onCsvColumnSelect,
  upstreamOutputs = [],
  onMappingChange,
  currentMapping,
  autoMappingDisabled = false,
  onReenableAutoMapping,
  initialConfig,
}: InputModalProps) => {
  const isExperimentalInput =
    normalizeAlias(alias) === normalizeAlias('experimental_input');
  const [activeTab, setActiveTab] = useState<string>('csv')
  const [inputType, setInputType] = useState<'number' | 'string'>('number')

  // String transform state (used in CSV mode for string inputs)
  const [stringTransform, setStringTransform] = useState<StringTransform>('as-is')

  // CSV state - for fallback when no global CSV sources
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [selectedHeader, setSelectedHeader] = useState<string>('')
  const [csvData, setCsvData] = useState<any[]>([])
  // Global CSV state
  const [selectedGlobalCsv, setSelectedGlobalCsv] = useState<{ fileId: string; column: string } | null>(null)
  const [selectedUnits, setSelectedUnits] = useState<string>('')

  // Range input state for numeric inputs
  const [rangeStart, setRangeStart] = useState<string>('')
  const [rangeEnd, setRangeEnd] = useState<string>('')
  const [rangeStep, setRangeStep] = useState<string>('')
  const [rangeError, setRangeError] = useState<string>('')
  const [rangePreviewCount, setRangePreviewCount] = useState<number | null>(null)

  // Upstream mapping state
  const [selectedUpstream, setSelectedUpstream] = useState<{ sourceFile: string; sourceAlias: string; sourceType?: string; units?: string } | null>(currentMapping || null)

  // Initialize state when modal opens with a new config (keyed by alias)
  useEffect(() => {
    if (opened) {
      // Always reset state first when opening for a new input
      setInputType(initialConfig?.inputType || 'number');
      // Initialize units from initialConfig or currentMapping (for upstream mappings)
      setSelectedUnits(initialConfig?.units || currentMapping?.units || '');
      setStringTransform(initialConfig?.stringTransform || 'as-is');
      // If current mapping exists, open in upstream tab so user can see/clear it
      setActiveTab(currentMapping ? 'upstream' : 'csv');

      // Initialize range state for numeric inputs
      if ((initialConfig?.inputType || 'number') === 'number') {
        const initialValues = Array.isArray(initialConfig?.value) ? initialConfig?.value : null;
        const numericValues = initialValues?.filter((v): v is number => typeof v === 'number') ?? null;
        if (numericValues && numericValues.length === initialValues?.length) {
          const derived = deriveRangeFromValues(numericValues);
          if (derived) {
            setRangeStart(String(derived.start));
            setRangeEnd(String(derived.end));
            setRangeStep(String(derived.step));
            setRangePreviewCount(null);
          } else {
            setRangeStart('');
            setRangeEnd('');
            setRangeStep('');
            setRangePreviewCount(numericValues.length);
          }
        } else {
          setRangeStart('');
          setRangeEnd('');
          setRangeStep('');
          setRangePreviewCount(null);
        }
        setRangeError('');
      } else {
        setRangeStart('');
        setRangeEnd('');
        setRangeStep('');
        setRangePreviewCount(null);
        setRangeError('');
      }
    }
  }, [opened, alias, initialConfig?.inputType, initialConfig?.units, initialConfig?.stringTransform, currentMapping]);

  useEffect(() => {
    if (csvFile) {
      getHeaders(csvFile).then(setCsvHeaders).catch(console.error);
      parseCSV(csvFile).then(setCsvData).catch(console.error);
    } else {
      setCsvHeaders([]);
      setCsvData([]);
      setSelectedHeader('');
    }
  }, [csvFile]);

  // Reset activeTab when inputType changes
  useEffect(() => {
    setActiveTab('csv');
    if (inputType !== 'number') {
      setRangeStart('');
      setRangeEnd('');
      setRangeStep('');
      setRangePreviewCount(null);
      setRangeError('');
    }
  }, [inputType]);

  useEffect(() => {
    if (activeTab !== 'range') {
      setRangeError('');
    }
  }, [activeTab]);

  // Sync selectedUpstream with currentMapping prop
  useEffect(() => {
    setSelectedUpstream(currentMapping || null);
  }, [currentMapping]);

  // Helper function to apply string transformation
  const applyStringTransform = (value: string): string => {
    if (stringTransform === 'uppercase') return value.toUpperCase();
    if (stringTransform === 'lowercase') return value.toLowerCase();
    return value;
  };

  const getRangeInputString = (): string | null => {
    if (!rangeStart.trim() && !rangeEnd.trim() && !rangeStep.trim()) {
      return null;
    }
    if (!rangeStart.trim() || !rangeEnd.trim() || !rangeStep.trim()) {
      return null;
    }
    return `${rangeStart}..${rangeEnd}..${rangeStep}`;
  };

  const rangeParseResult = (() => {
    if (inputType !== 'number' || activeTab !== 'range') return null;
    const rangeInput = getRangeInputString();
    if (!rangeInput) return null;
    return parseRangeInput(rangeInput);
  })();

  useEffect(() => {
    if (inputType !== 'number' || activeTab !== 'range') return;
    const rangeInput = getRangeInputString();
    if (!rangeInput) {
      if (rangeStart.trim() || rangeEnd.trim() || rangeStep.trim()) {
        setRangeError('Enter start, end, and step');
      }
      return;
    }
    const parsed = parseRangeInput(rangeInput);
    setRangeError(parsed.valid ? '' : (parsed.error || 'Invalid range input'));
    if (parsed.valid) {
      setRangePreviewCount(parsed.values?.length ?? null);
    } else {
      setRangePreviewCount(null);
    }
  }, [rangeStart, rangeEnd, rangeStep, inputType, activeTab]);

  const handleSave = () => {
    // Handle upstream mapping tab
    if (activeTab === 'upstream') {
      if (selectedUpstream) {
        // Include units in the mapping object
        onMappingChange?.({
          ...selectedUpstream,
          units: selectedUnits || undefined,
        });
      }
      onClose();
      return;
    }

    if (activeTab === 'range') {
      const rangeInput = getRangeInputString();
      if (!rangeInput) {
        return;
      }
      const parsed = parseRangeInput(rangeInput);
      if (!parsed.valid || !parsed.values) {
        setRangeError(parsed.error || 'Invalid range input');
        return;
      }
      onSave({
        alias: alias,
        value: parsed.values,
        units: selectedUnits || undefined,
        inputType: inputType,
      });
      return;
    }

    let value: any = null;
    let csvSource: { fileId: string; column: string } | undefined = undefined;

    if (activeTab === 'csv') {
      // Check for global CSV source first
      if (selectedGlobalCsv) {
        csvSource = selectedGlobalCsv;
        value = `csv:${selectedGlobalCsv.fileId}:${selectedGlobalCsv.column}`;
        onCsvColumnSelect?.(selectedGlobalCsv.fileId, selectedGlobalCsv.column);
      } else if (selectedHeader && csvData.length > 0) {
        // Fallback to per-input CSV upload
        if (inputType === 'number') {
          value = csvData.map(row => Number(row[selectedHeader]));
        } else {
          const rawCsvValues = csvData
            .map(row => applyStringTransform(String(row[selectedHeader]).trim()))
            .filter(v => v.length > 0);
          value = rawCsvValues;
        }
      }
    }

    if (value !== null) {
      onSave({
        alias: alias,
        value: value,
        units: inputType === 'number' ? (selectedUnits || undefined) : undefined,
        inputType: inputType,
        csvSource: csvSource,
        stringTransform: inputType === 'string' ? stringTransform : undefined,
      });
    }
  }

  const unitDisplay = getUnitDisplay(selectedUnits);
  const disableSave = activeTab === 'range' && inputType === 'number' && (!rangeParseResult?.valid || !!rangeError);

  if (isExperimentalInput) {
    return (
      <Dialog
        open={opened}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xl,
            p: 0.5,
            boxShadow: tokens.shadow.xl,
            border: `1px solid ${tokens.neutral[200]}`,
          }
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: tokens.surface.overlay,
            }
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: tokens.primary[700] }}>
            Configure: {alias}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This input is system-controlled and cannot be edited.
            </Typography>
            <TextField
              value={alias}
              size="small"
              disabled
              helperText="System-controlled"
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              borderColor: tokens.primary[100],
              color: tokens.primary[300],
              borderRadius: tokens.radius.base,
              '&:hover': {
                borderColor: tokens.primary[600],
                color: tokens.primary[600],
                background: tokens.primary[50],
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={opened}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="input-modal-title"
      PaperProps={{
        sx: {
          borderRadius: tokens.radius.xl,
          p: 0.5,
          boxShadow: tokens.shadow.xl,
          border: `1px solid ${tokens.neutral[200]}`,
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: tokens.surface.overlay,
          }
        }
      }}
    >
      <DialogTitle id="input-modal-title" sx={{ pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, color: tokens.primary[700] }}>
          Configure: {alias}
        </Typography>

        {/* Unit badge display */}
        {inputType === 'number' && (
          <Box sx={{
            mt: 0.75,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            background: tokens.primary[50],
            border: `1px solid ${tokens.primary[200]}`,
            borderRadius: tokens.radius.md,
            padding: "5px 12px",
          }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.primary[800] }}>
              {unitDisplay.short}
            </Typography>
            <Typography sx={{ fontSize: 14, color: tokens.primary[400], fontWeight: 500 }}>
              {unitDisplay.full}
            </Typography>
          </Box>
        )}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ maxHeight: '70vh', overflowY: 'auto', pt: 1 }}>
          {/* Type toggle (Number/String) */}
          <Box sx={{
            background: tokens.primary[50],
            borderRadius: tokens.radius.lg,
            p: "3px",
            border: `1px solid ${tokens.primary[100]}`,
          }}>
            <ToggleButtonGroup
              value={inputType}
              exclusive
              onChange={(_, val) => val && setInputType(val as 'number' | 'string')}
              fullWidth
              size="small"
              sx={{
                '& .MuiToggleButtonGroup-grouped': {
                  margin: 0,
                  border: 0,
                  borderRadius: '10px !important',
                },
              }}
            >
              <ToggleButton
                value="number"
                sx={{
                  flex: 1,
                  borderRadius: '10px',
                  border: 'none',
                  textTransform: 'none',
                  background: inputType === 'number' ? tokens.surface.elevated : 'transparent',
                  color: inputType === 'number' ? tokens.primary[800] : tokens.primary[300],
                  fontWeight: inputType === 'number' ? 600 : 400,
                  boxShadow: inputType === 'number' ? tokens.shadow.sm : 'none',
                }}
              >
                Number
              </ToggleButton>
              <ToggleButton
                value="string"
                sx={{
                  flex: 1,
                  borderRadius: '10px',
                  border: 'none',
                  textTransform: 'none',
                  background: inputType === 'string' ? tokens.surface.elevated : 'transparent',
                  color: inputType === 'string' ? tokens.primary[800] : tokens.primary[300],
                  fontWeight: inputType === 'string' ? 600 : 400,
                  boxShadow: inputType === 'string' ? tokens.shadow.sm : 'none',
                }}
              >
                String
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Input mode tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => v && setActiveTab(v)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTabs-indicator': {
                backgroundColor: tokens.primary[600],
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: tokens.primary[600],
                  fontWeight: 600,
                },
              },
            }}
          >
            <Tab label="CSV File" value="csv" />
            {inputType === 'number' && (
              <Tab label="Range" value="range" />
            )}
            <Tab label="Upstream" value="upstream" />
          </Tabs>

          <Box sx={{ mt: 1 }}>
            {activeTab === 'csv' && (
              <Stack spacing={2}>
                {csvColumnsGrouped && csvColumnsGrouped.length > 0 ? (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Select column from uploaded CSV files
                    </Typography>
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
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: tokens.fontStack.mono, fontSize: '0.875rem' }}>
                                {option.preview.slice(0, 3).join(', ')}{option.preview.length > 3 ? '...' : ''}
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select column from uploaded CSV"
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: tokens.radius.base,
                              background: tokens.primary[50],
                              '& fieldset': { borderColor: tokens.primary[100] },
                            },
                          }}
                        />
                      )}
                      onChange={(_, newValue) => {
                        if (newValue) {
                          // D-11: If upstream mapping exists, clear it when selecting CSV
                          if (selectedUpstream) {
                            setSelectedUpstream(null);
                          }
                          const [fileId, column] = newValue.value.split('|');
                          setSelectedGlobalCsv({ fileId, column });
                        } else {
                          setSelectedGlobalCsv(null);
                        }
                      }}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Column values will be loaded from the selected CSV during execution
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      No global CSV files uploaded. Upload a CSV for this input or use the CSV Sources panel.
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{
                        justifyContent: 'flex-start',
                        borderRadius: tokens.radius.base,
                        borderColor: tokens.primary[100],
                        color: tokens.primary[600],
                        '&:hover': {
                          borderColor: tokens.primary[600],
                          background: tokens.primary[50],
                        },
                      }}
                    >
                      Upload CSV for this input
                      <input
                        type="file"
                        accept=".csv"
                        hidden
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                    {csvFile && (
                      <Typography variant="body2" color="text.secondary">
                        Selected: {csvFile.name}
                      </Typography>
                    )}
                    {csvHeaders.length > 0 && (
                      <FormControl fullWidth size="small">
                        <InputLabel>Select Column</InputLabel>
                        <Select
                          value={selectedHeader}
                          onChange={(e) => setSelectedHeader(e.target.value)}
                          label="Select Column"
                          sx={{
                            borderRadius: tokens.radius.base,
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary[100] },
                          }}
                        >
                          {csvHeaders.map((header) => (
                            <MenuItem key={header} value={header}>{header}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {selectedHeader && (
                      <Typography variant="caption" color="text.secondary">
                        Found {csvData.length} rows.
                      </Typography>
                    )}
                  </>
                )}
                {/* String transform dropdown for CSV inputs */}
                {inputType === 'string' && (
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '0.875rem' }}>Transform</InputLabel>
                    <Select
                      value={stringTransform}
                      onChange={(e) => setStringTransform(e.target.value as StringTransform)}
                      label="Transform"
                      sx={{
                        fontSize: '0.875rem',
                        borderRadius: tokens.radius.base,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary[100] },
                      }}
                    >
                      <MenuItem value="as-is" sx={{ fontSize: '0.875rem' }}>As-is</MenuItem>
                      <MenuItem value="uppercase" sx={{ fontSize: '0.875rem' }}>UPPERCASE</MenuItem>
                      <MenuItem value="lowercase" sx={{ fontSize: '0.875rem' }}>lowercase</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Stack>
            )}

            {activeTab === 'range' && inputType === 'number' && (
              <Stack spacing={1.5}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Enter numeric range (start, end, step)
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="Start"
                    size="small"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    aria-describedby="range-start-error"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: tokens.radius.base,
                        background: tokens.primary[50],
                        '& fieldset': { borderColor: tokens.primary[100] },
                      },
                    }}
                  />
                  <TextField
                    label="End"
                    size="small"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    aria-describedby="range-end-error"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: tokens.radius.base,
                        background: tokens.primary[50],
                        '& fieldset': { borderColor: tokens.primary[100] },
                      },
                    }}
                  />
                  <TextField
                    label="Step"
                    size="small"
                    value={rangeStep}
                    onChange={(e) => setRangeStep(e.target.value)}
                    aria-describedby="range-step-error"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: tokens.radius.base,
                        background: tokens.primary[50],
                        '& fieldset': { borderColor: tokens.primary[100] },
                      },
                    }}
                  />
                </Stack>
                {rangeError && (
                  <Typography id="range-error" variant="caption" color="error" role="alert">
                    {rangeError}
                  </Typography>
                )}
                {!rangeError && rangePreviewCount !== null && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    role="status"
                    aria-live="polite"
                  >
                    {rangeParseResult?.valid
                      ? `Will generate ${rangePreviewCount} values.`
                      : `Existing list has ${rangePreviewCount} values.`}
                  </Typography>
                )}
              </Stack>
            )}

            {activeTab === 'upstream' && (
              <Stack spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Select input or output from a previous workflow step
                </Typography>
                <Autocomplete
                  options={upstreamOutputs}
                  groupBy={(option) => option.group}
                  getOptionLabel={(option) => option.label}
                  value={upstreamOutputs.find(o => o.value === (selectedUpstream ? `${selectedUpstream.sourceFile}|${selectedUpstream.sourceAlias}|${selectedUpstream.sourceType || 'output'}` : '')) || null}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      const [sourceFile, sourceAlias, sourceType] = newValue.value.split('|');
                      setSelectedUpstream({ sourceFile, sourceAlias, sourceType: sourceType || 'output' });
                    } else {
                      setSelectedUpstream(null);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select upstream value"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: tokens.radius.base,
                          background: tokens.primary[50],
                          '& fieldset': { borderColor: tokens.primary[100] },
                        },
                      }}
                    />
                  )}
                  size="small"
                />
                {selectedUpstream && (
                  <Button
                    variant="text"
                    size="small"
                    color="error"
                    onClick={() => setSelectedUpstream(null)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Clear Mapping
                  </Button>
                )}
                {autoMappingDisabled && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => onReenableAutoMapping?.()}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Re-enable Auto
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  {upstreamOutputs.length === 0
                    ? 'No upstream values available. Add steps before this one to enable mapping.'
                    : 'The selected value (input or output) will be used as input for this parameter.'}
                </Typography>
              </Stack>
            )}
          </Box>

          {inputType === 'number' && (
            <FormControl fullWidth size="small">
              <InputLabel>Units</InputLabel>
              <Select
                value={selectedUnits}
                onChange={(e) => setSelectedUnits(e.target.value)}
                label="Units"
                sx={{
                  borderRadius: tokens.radius.base,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary[100] },
                }}
              >
                {UNIT_PRESETS.map((unit) => (
                  <MenuItem key={unit.value} value={unit.value}>{unit.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box
          component="span"
          id="save-button-disabled-reason"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {!rangeError && rangePreviewCount !== null && !rangeParseResult?.valid
            ? 'Fix range errors before saving'
            : 'Fill in all required fields before saving'}
        </Box>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: tokens.primary[100],
            color: tokens.primary[300],
            borderRadius: tokens.radius.base,
            '&:hover': {
              borderColor: tokens.primary[600],
              color: tokens.primary[600],
              background: tokens.primary[50],
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={disableSave}
          aria-describedby={disableSave ? 'save-button-disabled-reason' : undefined}
          sx={{
            background: tokens.primary[600],
            borderRadius: tokens.radius.base,
            fontWeight: 600,
            boxShadow: `0 4px 16px ${tokens.primary[600]}40`,
            '&:hover': {
              background: tokens.primary[700],
            },
          }}
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  )
}

