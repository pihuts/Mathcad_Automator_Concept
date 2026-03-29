import {
  Stack,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Alert,
  Box,
} from '@mui/material';
import {
  IconTrash,
  IconPlus,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconCalculator,
} from '@tabler/icons-react';
import iStyles from '../styles/industrial.module.css';
import { tokens } from '../theme/mui-theme';
import {
  browseFile, type WorkflowFile, type FileMapping, type StepResult, type MetaData,
} from '../services/api';
import { useState, useMemo } from 'react';
import { InputPill, type MappedSource } from './InputPill';
import { OutputPill } from './OutputPill';
import { detectInputType } from '../utils/workflowHelpers';
import { getStatusColor, StatusIcon, RunningCalculatorIcon } from '../utils/workflowStatus';

interface WorkflowBuilderProps {
  files: WorkflowFile[];
  mappings: FileMapping[];
  onFilesChange: (files: WorkflowFile[]) => void;
  onMappingsChange: (mappings: FileMapping[]) => void;
  onInputPillClick: (stepPosition: number, inputAlias: string) => void;
  selectedPill?: { stepPosition: number; inputAlias: string } | null;
  onFileSelected?: (filePath: string) => void;  // Callback for automatic metadata scanning
  onAnalyzeAll?: (filePaths: string[]) => Promise<void>;  // New callback for analyzing all files
  stepResults?: StepResult[];
  filesMetadata?: Record<string, MetaData>;  // File metadata for displaying inputs/outputs
}

export const WorkflowBuilder = ({
  files,
  mappings,
  onFilesChange,
  onMappingsChange,
  onInputPillClick,
  selectedPill,
  onFileSelected,
  onAnalyzeAll,
  stepResults,
  filesMetadata = {},
}: WorkflowBuilderProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Build unified step sequence for display
  // arrayIndex = index within the source array (files[])
  type UnifiedStep =
    | { type: 'calculation'; data: WorkflowFile; arrayIndex: number };

  const normalizeUnifiedSteps = (
    calculationSteps: WorkflowFile[]
  ): UnifiedStep[] => {
    const steps: UnifiedStep[] = [];
    calculationSteps.forEach((f, idx) => steps.push({ type: 'calculation', data: f, arrayIndex: idx }));

    const sorted = steps.sort((a, b) => {
      const posA = Number.isFinite(a.data.position) ? a.data.position : Number.MAX_SAFE_INTEGER;
      const posB = Number.isFinite(b.data.position) ? b.data.position : Number.MAX_SAFE_INTEGER;

      if (posA !== posB) {
        return posA - posB;
      }

      return a.arrayIndex - b.arrayIndex;
    });

    return sorted.map((step, idx) => (
      { ...step, data: { ...step.data, position: idx } }
    ));
  };

  const applyUnifiedSteps = (steps: UnifiedStep[]) => {
    const updatedFiles: WorkflowFile[] = [];
    steps.forEach((step, idx) => {
      if (step.type === 'calculation') {
        updatedFiles.push({ ...step.data, position: idx });
      }
    });
    onFilesChange(updatedFiles);
  };

  const unifiedSteps = useMemo(() => {
    return normalizeUnifiedSteps(files);
  }, [files]);

  const handleAnalyzeAll = async () => {
    // Get all valid file paths
    const validFilePaths = files.filter(f => f.file_path).map(f => f.file_path);

    if (validFilePaths.length === 0) {
      setAnalyzeError('No files to analyze. Please add workflow files first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      if (onAnalyzeAll) {
        await onAnalyzeAll(validFilePaths);
      }
    } catch (error: any) {
      console.error('Failed to analyze workflow files:', error);
      setAnalyzeError(error?.message || 'Failed to analyze workflow files');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddFile = async () => {
    // Auto-open file browse per CONTEXT.md - no empty card first
    const result = await browseFile();
    if (!result.cancelled && result.file_path) {
      const newFile: WorkflowFile = {
        file_path: result.file_path,
        inputs: [],
        position: unifiedSteps.length,
      };
      onFilesChange([...files, newFile]);
      // Trigger metadata scan for the new file
      if (onFileSelected) {
        onFileSelected(result.file_path);
      }
    }
    // If cancelled, do nothing - no empty step card created
  };

  const handleRemoveFile = (filePath: string) => {
    const newFiles = files.filter((f) => f.file_path !== filePath);

    applyUnifiedSteps(normalizeUnifiedSteps(newFiles));

    // Remove mappings involving this file
    const newMappings = mappings.filter(
      (m) => m.source_file !== filePath && m.target_file !== filePath
    );
    onMappingsChange(newMappings);
  };

  const handleMoveStep = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= unifiedSteps.length) return;

    const newUnifiedSteps = [...unifiedSteps];
    const [moved] = newUnifiedSteps.splice(currentIndex, 1);
    newUnifiedSteps.splice(targetIndex, 0, moved);

    applyUnifiedSteps(newUnifiedSteps);
  };

  // Helper to resolve mapped source for a given input
  const getMappedSource = (filePath: string, inputAlias: string): MappedSource | undefined => {
    const mapping = mappings.find(m => m.target_file === filePath && m.target_alias === inputAlias);
    if (!mapping) return undefined;
    // Find the source step index
    const sourceStepIndex = unifiedSteps.findIndex(
      s => s.type === 'calculation' && s.data.file_path === mapping.source_file
    );
    return {
      stepIndex: sourceStepIndex + 1, // 1-based display
      stepLabel: mapping.source_file.split('\\').pop() || '',
      outputAlias: mapping.source_alias,
    };
  };

  // Helper to compute value status string for an input
  const getValueStatus = (file: WorkflowFile, inputAlias: string): string | undefined => {
    const inputConfig = file.inputs?.find(ic => ic.alias === inputAlias);
    if (!inputConfig) return undefined;

    const value = inputConfig.value;
    if (Array.isArray(value)) {
      if (value.length === 0) return undefined;
      if (value.length === 1) return `Single: ${value[0]}`;
      // Check if it looks like a range (3 numeric elements: start, end, step or generated range)
      // For simplicity, just show count
      return `List: ${value.length} values`;
    }
    if (value !== undefined && value !== null && value !== '') {
      return `Single: ${value}${inputConfig.units ? ' ' + inputConfig.units : ''}`;
    }
    return undefined;
  };

  const getMappingsForFile = (filePath: string) => {
    return mappings.filter((m) => m.target_file === filePath);
  };

  // Step status helper functions
  const getStepStatus = (filePath: string): StepResult | undefined => {
    return stepResults?.find(sr => sr.file_path === filePath);
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography className={iStyles.techLabel} sx={{ fontWeight: 600 }}>WORKFLOW SEQUENCE</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<IconSearch size={14} />}
            onClick={handleAnalyzeAll}
            disabled={isAnalyzing || files.length === 0 || files.every(f => !f.file_path)}
            variant="outlined"
          >
            ANALYZE ALL
          </Button>
          <Button size="small" startIcon={<IconPlus size={14} />} onClick={handleAddFile} variant="outlined">
            ADD STEP
          </Button>
        </Box>
      </Box>

      {analyzeError && (
        <Alert severity="error" onClose={() => setAnalyzeError(null)}>
          {analyzeError}
        </Alert>
      )}

      <Stack spacing={1}>
        {unifiedSteps.map((step, index) => {
          if (step.type === 'calculation') {
            const file = step.data;
            const metadata = filesMetadata[file.file_path];
            const stepResult = getStepStatus(file.file_path);
            const hasMetadata = metadata && (metadata.inputs?.length > 0 || metadata.outputs?.length > 0);

            return (
              <Paper
                key={file.file_path || `new-calc-${step.arrayIndex}`}
                className={iStyles.card}
                sx={{
                  p: 2,
                  borderRadius: 0,
                  backgroundColor: stepResult ? getStatusColor(stepResult.status) : undefined,
                }}
              >
                <Stack spacing={1}>
                  {/* Header row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: 0, alignItems: 'center' }}>
                      <Chip label={(index + 1).toString().padStart(2, '0')} size="small" color="primary" />
                      <IconCalculator size={16} style={{ color: tokens.primary[700] }} />
                      {file.file_path ? (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: tokens.fontStack.mono, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.file_path}>
                          {file.file_path.split('\\').pop()}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">NO FILE SELECTED</Typography>
                      )}
                      {/* Step status indicator */}
                      {stepResult && (
                        <Tooltip title={`${stepResult.status.toUpperCase()}${stepResult.error ? ': ' + stepResult.error : ''}`} arrow>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {stepResult.status === 'running'
                              ? <RunningCalculatorIcon size={16} />
                              : <StatusIcon status={stepResult.status} size={16} />}
                          </Box>
                        </Tooltip>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {/* Mappings count badge */}
                      {getMappingsForFile(file.file_path).length > 0 && (
                        <Chip
                          label={`${getMappingsForFile(file.file_path).length} LINK${getMappingsForFile(file.file_path).length > 1 ? 'S' : ''}`}
                          size="small"
                          variant="outlined"
                          color="info"
                        />
                      )}

                      {/* Step status badge */}
                      {stepResult && stepResult.status !== 'pending' && (
                        <Chip
                          label={stepResult.status.toUpperCase()}
                          size="small"
                          color={stepResult.status === 'completed' ? 'success' : stepResult.status === 'failed' ? 'error' : stepResult.status === 'blocked' ? 'default' : 'warning'}
                        />
                      )}

                      {/* Per-step Analyze button */}
                      {file.file_path && !hasMetadata && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<IconSearch size={14} />}
                          onClick={() => onFileSelected?.(file.file_path)}
                        >
                          ANALYZE
                        </Button>
                      )}

                      {/* Up/Down arrow buttons */}
                      <IconButton
                        size="small"
                        onClick={() => handleMoveStep(index, 'up')}
                        disabled={index === 0}
                        aria-label="Move step up"
                      >
                        <IconArrowUp size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleMoveStep(index, 'down')}
                        disabled={index === unifiedSteps.length - 1}
                        aria-label="Move step down"
                      >
                        <IconArrowDown size={16} />
                      </IconButton>
                      {/* Delete button */}
                      <Tooltip title="Remove file" arrow>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveFile(file.file_path)}
                          aria-label="Remove file"
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Input pills section (always visible, no collapse) */}
                  {hasMetadata && metadata.inputs && metadata.inputs.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" className={iStyles.techLabel} sx={{ fontWeight: 600 }}>INPUTS</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {metadata.inputs.map((input) => (
                          <InputPill
                            key={input.alias}
                            alias={input.alias}
                            mappedSource={getMappedSource(file.file_path, input.alias)}
                            valueType={detectInputType(input.name)}
                            valueStatus={getValueStatus(file, input.alias)}
                            isSelected={selectedPill?.stepPosition === step.data.position && selectedPill?.inputAlias === input.alias}
                            onClick={() => {
                              console.log('[InputPill onClick] Fired for:', input.alias);
                              onInputPillClick(step.data.position, input.alias);
                            }}
                          />
                        ))}
                      </Box>
                    </Stack>
                  )}

                  {/* Output pills section (always visible) */}
                  {hasMetadata && metadata.outputs && metadata.outputs.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" className={iStyles.techLabel} sx={{ fontWeight: 600 }}>OUTPUTS</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {metadata.outputs.map((output) => (
                          <OutputPill key={output.alias} alias={output.alias} />
                        ))}
                      </Box>
                    </Stack>
                  )}

                  {/* No metadata message */}
                  {file.file_path && !hasMetadata && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">Click ANALYZE to load inputs/outputs</Typography>
                  )}
                </Stack>
              </Paper>
            );
          }
        })}
      </Stack>
    </Stack>
  );
};
