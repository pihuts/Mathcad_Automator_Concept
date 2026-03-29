import {
  Stack, Box, Typography, Button, Chip, IconButton, Tooltip, Alert, CircularProgress,
} from '@mui/material';
import {
  IconTrash,
  IconPlus,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconCalculator,
} from '@tabler/icons-react';
import { tokens } from '../theme/mui-theme';
import { useState, useMemo, useRef } from 'react';
import {
  browseFile,
  type WorkflowFile,
  type FileMapping,
  type StepResult,
  type MetaData,
} from '../services/api';
import { InputPill, type MappedSource } from './InputPill';
import { OutputPill } from './OutputPill';
import { MuiNotebookCard } from './mui/MuiNotebookCard';
import { getStatusColor, StatusIcon } from '../utils/workflowStatus';
import { detectInputType } from '../utils/workflowHelpers';

interface WorkflowCanvasProps {
  files: WorkflowFile[];
  mappings: FileMapping[];
  onFilesChange: (files: WorkflowFile[]) => void;
  onMappingsChange: (mappings: FileMapping[]) => void;
  onInputPillClick: (stepPosition: number, inputAlias: string) => void;
  selectedPill?: { stepPosition: number; inputAlias: string } | null;
  onFileSelected?: (filePath: string) => void;
  onAnalyzeAll?: (filePaths: string[]) => Promise<void>;
  stepResults?: StepResult[];
  filesMetadata?: Record<string, MetaData>;
}

/**
 * WorkflowCanvas component for the center panel of the three-panel layout.
 * Displays workflow steps as vertical cards with NotebookLM-inspired styling.
 * Uses MUI components and MuiNotebookCard (24px radius).
 */
export const WorkflowCanvas = ({
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
}: WorkflowCanvasProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build unified step sequence for display
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
    const validFilePaths = files.filter((f) => f.file_path).map((f) => f.file_path);

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
    } catch (error: unknown) {
      console.error('Failed to analyze workflow files:', error);
      setAnalyzeError((error as Error)?.message || 'Failed to analyze workflow files');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddFile = async () => {
    const result = await browseFile();
    if (!result.cancelled && result.file_path) {
      const newFile: WorkflowFile = {
        file_path: result.file_path,
        inputs: [],
        position: unifiedSteps.length,
      };
      onFilesChange([...files, newFile]);
      if (onFileSelected) {
        onFileSelected(result.file_path);
      }
    }
  };

  const handleRemoveFile = (filePath: string) => {
    const newFiles = files.filter((f) => f.file_path !== filePath);

    applyUnifiedSteps(normalizeUnifiedSteps(newFiles));

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

  const getMappedSource = (filePath: string, inputAlias: string): MappedSource | undefined => {
    const mapping = mappings.find((m) => m.target_file === filePath && m.target_alias === inputAlias);
    if (!mapping) return undefined;
    const sourceStepIndex = unifiedSteps.findIndex(
      (s) => s.type === 'calculation' && s.data.file_path === mapping.source_file
    );
    return {
      stepIndex: sourceStepIndex + 1,
      stepLabel: mapping.source_file.split('\\').pop() || '',
      outputAlias: mapping.source_alias,
    };
  };

  const getValueStatus = (file: WorkflowFile, inputAlias: string): string | undefined => {
    const inputConfig = file.inputs?.find((ic) => ic.alias === inputAlias);
    if (!inputConfig) return undefined;

    const value = inputConfig.value;
    if (Array.isArray(value)) {
      if (value.length === 0) return undefined;
      if (value.length === 1) return `Single: ${value[0]}`;
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

  const getStepStatus = (filePath: string): StepResult | undefined => {
    return stepResults?.find((sr) => sr.file_path === filePath);
  };

  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center"
        sx={{ mb: 3, px: 3, pt: 3 }}
      >
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={isAnalyzing ? <CircularProgress size={16} color="primary" /> : <IconSearch size={16} />}
            onClick={handleAnalyzeAll}
            disabled={isAnalyzing || files.length === 0 || files.every((f) => !f.file_path)}
            variant="outlined"
            sx={{ borderRadius: '99px', textTransform: 'none', fontWeight: 600 }}
          >
            ANALYZE ALL
          </Button>
          <Button
            size="small"
            startIcon={<IconPlus size={16} />}
            onClick={handleAddFile}
            variant="outlined"
            sx={{ borderRadius: '99px', textTransform: 'none', fontWeight: 600 }}
          >
            ADD STEP
          </Button>
        </Stack>
      </Stack>

      {analyzeError && (
        <Box sx={{ px: 3, mb: 2 }}>
          <Alert
            severity="error"
            onClose={() => setAnalyzeError(null)}
            sx={{ borderRadius: '12px' }}
          >
            {analyzeError}
          </Alert>
        </Box>
      )}

      {/* Scrollable canvas */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 4 }}>
        <Stack spacing={2} ref={containerRef}>
          {unifiedSteps.map((step, index) => {
            if (step.type === 'calculation') {
              const file = step.data;
              const metadata = filesMetadata[file.file_path];
              const stepResult = getStepStatus(file.file_path);
              const hasMetadata = metadata && (metadata.inputs?.length > 0 || metadata.outputs?.length > 0);

              return (
                <MuiNotebookCard
                  key={file.file_path || `new-calc-${step.arrayIndex}`}
                  sx={{
                    backgroundColor: stepResult ? getStatusColor(stepResult.status) : tokens.surface.paper,
                  }}
                >
                  <Stack spacing={2}>
                    {/* Header row */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        <Chip
                          label={(index + 1).toString().padStart(2, '0')}
                          size="small"
                          color="primary"
                          sx={{ height: 32, fontSize: '0.875rem', fontWeight: 700 }}
                        />
                        <IconCalculator size={18} style={{ color: tokens.accent[500] }} />
                        {file.file_path ? (
                          <Typography
                            variant="caption"
                            sx={{ 
                              fontFamily: tokens.fontStack.mono, 
                              fontWeight: 500, 
                              color: 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={file.file_path}
                          >
                            {file.file_path.split('\\').pop()}
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            NO FILE SELECTED
                          </Typography>
                        )}
                        {stepResult && (
                          <Tooltip
                            title={`${stepResult.status.toUpperCase()}${stepResult.error ? ': ' + stepResult.error : ''}`}
                            arrow
                          >
                            <Box sx={{ display: 'flex' }}>
                              <StatusIcon status={stepResult.status} size={18} />
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>

                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {getMappingsForFile(file.file_path).length > 0 && (
                          <Chip 
                            label={`${getMappingsForFile(file.file_path).length} LINK${getMappingsForFile(file.file_path).length > 1 ? 'S' : ''}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ height: 32, fontSize: '0.875rem' }}
                          />
                        )}

                        {stepResult && stepResult.status !== 'pending' && (
                          <Chip 
                            label={stepResult.status.toUpperCase()}
                            size="small"
                            color={
                              stepResult.status === 'completed'
                                ? 'success'
                                : stepResult.status === 'failed'
                                  ? 'error'
                                  : stepResult.status === 'blocked'
                                    ? 'default'
                                    : 'warning'
                            }
                            sx={{ height: 32, fontSize: '0.875rem' }}
                          />
                        )}

                        {file.file_path && !hasMetadata && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<IconSearch size={14} />}
                            onClick={() => onFileSelected?.(file.file_path)}
                            sx={{ fontSize: '0.875rem', height: 24 }}
                          >
                            ANALYZE
                          </Button>
                        )}

                        <IconButton
                          size="small"
                          onClick={() => handleMoveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          <IconArrowUp size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleMoveStep(index, 'down')}
                          disabled={index === unifiedSteps.length - 1}
                        >
                          <IconArrowDown size={16} />
                        </IconButton>
                        <Tooltip title="Remove file" arrow>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveFile(file.file_path)}
                          >
                            <IconTrash size={16} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Input pills section */}
                    {hasMetadata && metadata.inputs && metadata.inputs.length > 0 && (
                      <Stack spacing={1}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: '0.875rem', 
                            color: 'text.secondary',
                            letterSpacing: '0.05em'
                          }}
                        >
                          INPUTS
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {metadata.inputs.map((input) => (
                            <InputPill
                              key={input.alias}
                              alias={input.alias}
                              mappedSource={getMappedSource(file.file_path, input.alias)}
                              valueType={detectInputType(input.name)}
                              valueStatus={getValueStatus(file, input.alias)}
                              isSelected={
                                selectedPill?.stepPosition === step.data.position &&
                                selectedPill?.inputAlias === input.alias
                              }
                              onClick={() => {
                                onInputPillClick(step.data.position, input.alias);
                              }}
                            />
                          ))}
                        </Box>
                      </Stack>
                    )}

                    {/* Output pills section */}
                    {hasMetadata && metadata.outputs && metadata.outputs.length > 0 && (
                      <Stack spacing={1}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: '0.875rem', 
                            color: 'text.secondary',
                            letterSpacing: '0.05em'
                          }}
                        >
                          OUTPUTS
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {metadata.outputs.map((output) => (
                            <OutputPill key={output.alias} alias={output.alias} />
                          ))}
                        </Box>
                      </Stack>
                    )}

                    {file.file_path && !hasMetadata && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                        Click ANALYZE to load inputs/outputs
                      </Typography>
                    )}
                  </Stack>
                </MuiNotebookCard>
              );
            }
          })}
        </Stack>
      </Box>
    </Box>
  );
};


