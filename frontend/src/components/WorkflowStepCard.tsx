import React from 'react';
import {
  Stack,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  ButtonBase,
  Button,
  Divider,
  Collapse,
  Checkbox,
  Paper,
} from '@mui/material';
import {
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconSearch,
  IconLink,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { InputPillCard, type CsvSource } from './InputPillCard';
import { OutputPillCard } from './OutputPillCard';
import { MuiNotebookCard } from './mui/MuiNotebookCard';
import { UNIT_PRESETS } from '../constants/units';
import { tokens } from '../theme/mui-theme';
import type {
  WorkflowFile,
  MetaData,
  StepResult,
} from '../services/api';
import { getStatusTone } from '../utils/workflowStatus';
import { detectInputType } from '../utils/workflowHelpers';
import { getDisplayName } from '../utils/fileUtils';
import { isExperimentalInputAlias } from '../utils/workflowAutoMapping';
import type { MappedSource } from './InputPill';

interface WorkflowStepCardProps {
  stepIndex: number;
  file: WorkflowFile;
  metadata?: MetaData;
  stepResult?: StepResult;
  getInputValues: (filePath: string, alias: string) => (string | number)[];
  getInputUnits: (filePath: string, alias: string) => string | undefined;
  getInputCsvSource: (filePath: string, alias: string) => CsvSource | undefined;
  isInputMapped: (filePath: string, alias: string) => boolean;
  isInputAutoMapped: (filePath: string, alias: string) => boolean;
  getMappedSource: (filePath: string, alias: string) => MappedSource | undefined;
  onInputValueChange: (filePath: string, alias: string, values: any[]) => void;
  onInputUnitChange: (filePath: string, alias: string, unit: string) => void;
  onOpenInputModal: (filePath: string, alias: string, inputName: string) => void;
  onConfigureMapping: (filePath: string, alias: string, inputName: string) => void;
  onUnlockInput: (filePath: string, alias: string) => void;
  onCsvUnlink: (filePath: string, alias: string) => void;
  getOutputUnits?: (filePath: string, alias: string) => string | undefined;
  onOutputUnitChange?: (filePath: string, alias: string, unit: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAnalyze: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  mappingCount: number;
  isSelected?: boolean;
  savePdfMode: 'inherit' | 'global' | 'on' | 'off';
  saveMcdxMode: 'inherit' | 'global' | 'on' | 'off';
  onSaveModeChange: (format: 'pdf' | 'mcdx', mode: 'inherit' | 'global' | 'on' | 'off') => void;
  iterationMode: 'combination' | 'zip';
  onIterationModeChange: (mode: 'combination' | 'zip') => void;
}

const sectionLabelSx = {
  fontWeight: 700,
  fontSize: '0.875rem',
  letterSpacing: '0.12em',
  color: tokens.neutral[600],
  textTransform: 'uppercase' as const,
};

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({
  stepIndex: _stepIndex,
  file,
  metadata,
  stepResult,
  getInputValues,
  getInputUnits,
  getInputCsvSource,
  isInputMapped,
  isInputAutoMapped,
  getMappedSource,
  onInputValueChange,
  onInputUnitChange,
  onOpenInputModal,
  onUnlockInput,
  onCsvUnlink,
  getOutputUnits,
  onOutputUnitChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAnalyze,
  canMoveUp,
  canMoveDown,
  mappingCount: _mappingCount,
  isSelected = false,
  savePdfMode,
  saveMcdxMode,
  onSaveModeChange,
  iterationMode,
  onIterationModeChange,
}) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const hasMetadata = metadata && (metadata.inputs?.length > 0 || metadata.outputs?.length > 0);
  const fileName = getDisplayName(file.file_path);
  const unitOptions = UNIT_PRESETS.map((u) => u.value).filter((v) => v !== '');
  const statusTone = getStatusTone(stepResult?.status);
  const getNextMode = (mode: 'inherit' | 'global' | 'on' | 'off') => {
    if (mode === 'inherit') return 'global';
    if (mode === 'global') return 'on';
    if (mode === 'on') return 'off';
    return 'inherit';
  };

  const renderExportToggle = (
    format: 'pdf' | 'mcdx',
    label: string,
    mode: 'inherit' | 'global' | 'on' | 'off'
  ) => {
    const stateLabel = mode === 'on' ? 'on' : mode === 'off' ? 'off' : 'auto';
    const isAutomatic = mode === 'inherit' || mode === 'global';

    return (
      <Tooltip
        key={format}
        title={
          mode === 'on'
            ? `${label} export forced on for this step. Click to force off.`
            : mode === 'off'
              ? `${label} export forced off for this step. Click to return to workflow default.`
              : `${label} export follows the workflow default. Click to force on for this step.`
        }
        arrow
      >
        <ButtonBase
          onClick={() => onSaveModeChange(format, getNextMode(mode))}
          aria-label={`${label} export ${stateLabel} for this step`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.35,
            px: 0.15,
            py: 0.1,
            minHeight: 44,
            borderRadius: tokens.radius.md,
            color: tokens.neutral[700],
            justifyContent: 'flex-start',
            '&:hover': {
              backgroundColor: tokens.primary[50],
            },
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.35,
              minHeight: 44,
              '& .export-label': {
                fontSize: tokens.fontSize.xs,
                fontWeight: 600,
                color: mode === 'off' ? tokens.neutral[400] : tokens.neutral[700],
              },
            }}
          >
            <Checkbox
              checked={mode === 'on'}
              indeterminate={isAutomatic}
              disableRipple
              sx={{
                p: 0,
                mr: 0.25,
                color: tokens.primary[500],
                '&.Mui-checked': { color: tokens.primary[700] },
                '&.MuiCheckbox-indeterminate': { color: tokens.primary[700] },
              }}
            />
            <Typography className="export-label">{label}</Typography>
          </Box>
        </ButtonBase>
      </Tooltip>
    );
  };

  return (
    <MuiNotebookCard
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundColor: tokens.neutral[0],
        borderColor: isSelected ? tokens.accent[500] : statusTone.border,
        boxShadow: isSelected ? `0 0 0 1px ${tokens.accent[400]}, ${tokens.shadow.md}` : 'none',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 6,
          background: stepResult?.status === 'running' ? tokens.primary[700] : statusTone.border,
          pointerEvents: 'none',
        },
      }}
    >
      <Stack spacing={2.25} sx={{ position: 'relative' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: tokens.radius.lg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: tokens.primary[50],
                  color: tokens.primary[700],
                  border: `1px solid ${tokens.primary[200]}`,
                  flexShrink: 0,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 6px)',
                    gap: '4px',
                  }}
                >
                  {[0, 1, 2, 3].map((dot) => (
                    <Box
                      key={dot}
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '2px',
                        backgroundColor: dot === 3 ? tokens.primary[400] : tokens.primary[700],
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Tooltip title={file.file_path || 'Pick a Mathcad file to define this stage of the workflow.'} arrow>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      fontSize: 'clamp(1.2rem, 1rem + 0.55vw, 1.5rem)',
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </Typography>
                </Tooltip>
              </Box>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            {file.file_path && !hasMetadata && (
              <Tooltip title="Analyze file to load inputs and outputs" arrow>
                <IconButton
                  size="small"
                  onClick={onAnalyze}
                  sx={{ minWidth: 44, minHeight: 44, bgcolor: tokens.neutral[50] }}
                >
                <IconSearch size={16} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Move step up" arrow>
              <IconButton
                size="small"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-disabled={!canMoveUp}
                aria-label="Move step up"
                sx={{ minWidth: 44, minHeight: 44, color: canMoveUp ? tokens.neutral[500] : tokens.neutral[300], bgcolor: tokens.neutral[50] }}
              >
                <IconArrowUp size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Move step down" arrow>
              <IconButton
                size="small"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-disabled={!canMoveDown}
                aria-label="Move step down"
                sx={{ minWidth: 44, minHeight: 44, color: canMoveDown ? tokens.neutral[500] : tokens.neutral[300], bgcolor: tokens.neutral[50] }}
              >
                <IconArrowDown size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title={detailsOpen ? 'Hide details' : 'Show details'} arrow>
              <IconButton size="small" onClick={() => setDetailsOpen((open) => !open)} aria-label={detailsOpen ? 'Hide stage details' : 'Show stage details'} sx={{ minWidth: 44, minHeight: 44, color: tokens.neutral[500], bgcolor: tokens.neutral[50] }}>
                {detailsOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove step" arrow>
              <IconButton size="small" color="error" onClick={onRemove} aria-label="Remove file" sx={{ minWidth: 44, minHeight: 44, bgcolor: tokens.error.light }}>
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {file.file_path && (
          <Box
            role="radiogroup"
            aria-label="Iteration mode"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: '4px',
              p: '4px',
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.primary[100]}`,
              backgroundColor: tokens.primary[50],
            }}
          >
            {[
              { value: 'combination' as const, label: 'Combination' },
              { value: 'zip' as const, label: 'Zip (pair by row)' },
            ].map((option) => {
              const active = iterationMode === option.value;
              return (
                <ButtonBase
                  key={option.value}
                  onClick={() => onIterationModeChange(option.value)}
                  role="radio"
                  aria-checked={active}
                  aria-label={`Set step iteration mode to ${option.label}`}
                  sx={{
                    minHeight: 44,
                    px: 1.5,
                    borderRadius: tokens.radius.sm,
                    justifyContent: 'center',
                    backgroundColor: active ? tokens.primary[700] : 'transparent',
                    color: active ? tokens.neutral[0] : tokens.neutral[700],
                    boxShadow: active ? tokens.shadow.sm : 'none',
                    border: active ? `1px solid ${tokens.primary[700]}` : '1px solid transparent',
                    transition: 'background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
                    '&:hover': {
                      backgroundColor: active ? tokens.primary[800] : tokens.surface.paper,
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${tokens.primary[700]}`,
                      outlineOffset: '2px',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: tokens.fontSize.xs,
                      fontWeight: active ? 700 : 600,
                      lineHeight: 1.2,
                      color: 'inherit',
                    }}
                  >
                    {option.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}

        {!hasMetadata && file.file_path ? (
          <Box
            sx={{
              p: 2,
              borderRadius: tokens.radius.lg,
              bgcolor: tokens.neutral[50],
              border: `1px dashed ${tokens.neutral[300]}`,
            }}
          >
            <Button variant="outlined" onClick={onAnalyze} sx={{ minHeight: 44, borderRadius: '99px', textTransform: 'none', fontWeight: 700 }}>
              Analyze file
            </Button>
          </Box>
        ) : (
          <>
            {hasMetadata && metadata.inputs && metadata.inputs.length > 0 && (() => {
              const userInputs = metadata.inputs.filter((input) => !isExperimentalInputAlias(input.alias));
              const systemInputs = metadata.inputs.filter((input) => isExperimentalInputAlias(input.alias));

              return (
                <Stack spacing={2}>
                  {/* System Inputs - always locked */}
                  {systemInputs.length > 0 && (
                    <Stack spacing={1.25}>
                      <Typography variant="caption" sx={sectionLabelSx}>
                        System Inputs
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        {systemInputs.map((input) => {
                          const experimentalValues = getInputValues(file.file_path, input.alias);
                          return (
                            <Box key={input.alias}>
                              <InputPillCard
                                alias={input.alias}
                                displayName={input.name}
                                type={detectInputType(input.name)}
                                values={experimentalValues}
                                units={getInputUnits(file.file_path, input.alias)}
                                unitOptions={unitOptions}
                                csvSource={getInputCsvSource(file.file_path, input.alias)}
                                onChange={() => {}}
                                onUnitChange={() => {}}
                                onOpenConfig={() => onOpenInputModal(file.file_path, input.alias, input.name)}
                                onCsvUnlink={() => {}}
                                onUnlock={() => {}}
                                locked={true}
                                isSystemInput={true}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Stack>
                  )}

                  {/* User Inputs */}
                  {userInputs.length > 0 && (
                    <Stack spacing={1.25}>
                      {systemInputs.length > 0 && (
                        <Typography variant="caption" sx={sectionLabelSx}>
                          User Inputs
                        </Typography>
                      )}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        {userInputs.map((input) => {
                          const mapped = isInputMapped(file.file_path, input.alias);
                          const mappedSource = getMappedSource(file.file_path, input.alias);
                          const autoMapped = isInputAutoMapped(file.file_path, input.alias);

                          return (
                            <Box key={input.alias} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                              {mapped && (mappedSource || autoMapped) && (
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    minWidth: 0,
                                    pl: 0.5,
                                  }}
                                >
                                  {mappedSource && (
                                    <Chip
                                      icon={<IconLink size={12} />}
                                      label={`From ${mappedSource.stepIndex}: ${mappedSource.outputAlias}`}
                                      size="small"
                                      sx={{
                                        height: 32,
                                        fontSize: '0.75rem', // Minimum 12px per WCAG 1.4.3
                                        maxWidth: { xs: '100%', md: 'calc(100% - 56px)' },
                                        backgroundColor: tokens.surface.paper,
                                        border: `1px solid ${tokens.accent[200]}`,
                                        color: tokens.accent[700],
                                        '& .MuiChip-label': {
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        },
                                      }}
                                    />
                                  )}
                                  {autoMapped && (
                                    <Tooltip title="Auto-mapped from a previous step" arrow placement="top">
                                      <Chip
                                        label="Auto"
                                        size="small"
                                        aria-label="Auto-mapped input"
                                        sx={{
                                          height: 28,
                                          fontSize: '0.75rem', // Minimum 12px per WCAG 1.4.3
                                          fontWeight: 700,
                                          letterSpacing: '0.06em',
                                          textTransform: 'uppercase',
                                          backgroundColor: tokens.neutral[50],
                                          border: `1px solid ${tokens.neutral[200]}`,
                                          color: tokens.neutral[600],
                                        }}
                                      />
                                    </Tooltip>
                                  )}
                                </Box>
                              )}
                              <InputPillCard
                                alias={input.alias}
                                displayName={input.name}
                                type={detectInputType(input.name)}
                                values={getInputValues(file.file_path, input.alias)}
                                units={getInputUnits(file.file_path, input.alias)}
                                unitOptions={unitOptions}
                                csvSource={getInputCsvSource(file.file_path, input.alias)}
                                onChange={(vals) => onInputValueChange(file.file_path, input.alias, vals)}
                                onUnitChange={(unit) => onInputUnitChange(file.file_path, input.alias, unit)}
                                onOpenConfig={() => onOpenInputModal(file.file_path, input.alias, input.name)}
                                onCsvUnlink={() => onCsvUnlink(file.file_path, input.alias)}
                                onUnlock={() => onUnlockInput(file.file_path, input.alias)}
                                locked={mapped}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Stack>
                  )}
                </Stack>
              );
            })()}

            {/* Output Units Configuration - always visible */}
            {hasMetadata && metadata.outputs && metadata.outputs.length > 0 && (
              <Stack spacing={1.25}>
                <Typography variant="caption" sx={sectionLabelSx}>
                  Output Units
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {metadata.outputs.map((output) => (
                    <OutputPillCard
                      key={output.alias}
                      alias={output.alias}
                      displayName={output.name}
                      units={getOutputUnits?.(file.file_path, output.alias)}
                      unitOptions={unitOptions}
                      onUnitChange={(unit) => onOutputUnitChange?.(file.file_path, output.alias, unit)}
                    />
                  ))}
                </Box>
              </Stack>
            )}

            {/* Output Values from Execution - shown when completed */}
            {hasMetadata && metadata.outputs && metadata.outputs.length > 0 && stepResult?.status === 'completed' && stepResult.outputs && (
              <Stack spacing={1.25}>
                <Typography variant="caption" sx={sectionLabelSx}>
                  Output Values
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {metadata.outputs.map((output) => {
                    const value = stepResult.outputs?.[output.alias];
                    const valueStr = value !== undefined ? (Array.isArray(value) ? value.join(', ') : String(value)) : '—';
                    const configuredUnits = getOutputUnits?.(file.file_path, output.alias);

                    return (
                      <Paper
                        key={output.alias}
                        elevation={0}
                        sx={{
                          backgroundColor: tokens.surface.paper,
                          borderRadius: tokens.radius.lg,
                          p: 2,
                          boxShadow: tokens.shadow.sm,
                          border: `1px solid`,
                          borderColor: tokens.accent[200],
                          transition: tokens.transition.fast,
                          '&:hover': {
                            borderColor: tokens.accent[400],
                            boxShadow: tokens.shadow.md,
                          },
                        }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: tokens.fontSize['2xl'], lineHeight: 1.05, color: tokens.accent[700], mb: 0.4 }}>
                          {output.alias}
                        </Typography>
                        <Typography sx={{ fontSize: tokens.fontSize.xs, color: tokens.accent[500], mb: 1, fontWeight: 700 }}>
                          {output.name} · Result
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                          <Typography sx={{ fontFamily: tokens.fontStack.mono, fontWeight: 700, fontSize: '1.1rem', color: tokens.accent[700] }}>
                            {valueStr}
                          </Typography>
                          {configuredUnits && (
                            <Typography sx={{ fontSize: tokens.fontSize.sm, color: tokens.accent[500], fontWeight: 600 }}>
                              [{configuredUnits}]
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              </Stack>
            )}

            <Collapse in={detailsOpen} timeout="auto" unmountOnExit>
              <Stack spacing={2.25}>
                <Divider />

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', lg: 'center' }}>
                  <Stack spacing={1}>
                    <Typography variant="caption" sx={sectionLabelSx}>
                      Step Export
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {renderExportToggle('pdf', 'PDF', savePdfMode)}
                      {renderExportToggle('mcdx', 'MCDX', saveMcdxMode)}
                    </Stack>
                  </Stack>
                </Stack>
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
    </MuiNotebookCard>
  );
};


