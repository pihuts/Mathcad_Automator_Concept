import {
  Stack,
  Box,
  Typography,
  Chip,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  IconArrowRight,
  IconDatabase,
  IconLink,
} from '@tabler/icons-react';
import { MuiBentoCard } from './mui/MuiNotebookCard';
import { tokens } from '../theme/mui-theme';
import {
  type WorkflowFile,
  type FileMapping,
  type MetaData,
  type InputConfig,
} from '../services/api';

/**
 * DataPanel props interface
 */
export interface DataPanelProps {
  /** All workflow files with their input configurations */
  files: WorkflowFile[];
  /** File-to-file output-to-input mappings */
  mappings: FileMapping[];
  /** Metadata for all files (inputs and outputs) */
  filesMetadata: Record<string, MetaData>;
  /** Click handler for input cards */
  onInputClick?: (stepPosition: number, inputAlias: string) => void;
}

/**
 * Get input type from value (numeric vs string detection)
 */
function detectInputType(value: any): 'numeric' | 'string' {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'string';
  if (typeof value === 'number') return 'numeric';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'numeric';
    return typeof value[0] === 'string' ? 'string' : 'numeric';
  }
  return 'numeric';
}

/**
 * Get value status for display
 */
function getValueStatus(
  input: InputConfig,
  targetFile: string,
  targetAlias: string,
  mappings: FileMapping[]
): { type: 'mapping' | 'value' | 'unconfigured'; text: string; sourceStep?: number } {
  const mapping = mappings.find(
    m => m.target_file === targetFile && m.target_alias === targetAlias
  );

  if (mapping) {
    return {
      type: 'mapping',
      text: `Step ${mapping.source_file}: ${mapping.source_alias}`,
    };
  }

  if (input.value !== undefined && input.value !== null) {
    const preview = getValuePreview(input.value);
    return { type: 'value', text: preview };
  }

  return { type: 'unconfigured', text: '(unconfigured)' };
}

/**
 * Get value preview string
 */
function getValuePreview(value: any): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) {
      return `[${value.map(String).join(', ')}]`;
    }
    return `• ${value.length} items`;
  }
  if (typeof value === 'object') return '• Object';
  return `• ${String(value)}`;
}

const techLabelStyle = {
  fontSize: '0.875rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: tokens.neutral[600],
};

/**
 * Left panel component for displaying inputs and mappings.
 * Refactored to MUI with NotebookLM-inspired styling.
 */
export function DataPanel({
  files,
  mappings,
  filesMetadata,
  onInputClick,
}: DataPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sortedFiles = [...files].sort((a, b) => a.position - b.position);

  const mappingsBySource: Record<string, FileMapping[]> = {};
  mappings.forEach(mapping => {
    if (!mappingsBySource[mapping.source_file]) {
      mappingsBySource[mapping.source_file] = [];
    }
    mappingsBySource[mapping.source_file].push(mapping);
  });

  const totalInputs = sortedFiles.reduce((sum, file) => {
    const metadata = filesMetadata[file.file_path];
    return sum + (metadata?.inputs?.length || 0);
  }, 0);

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Stack spacing={3} sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <IconDatabase size={18} color={tokens.accent[500]} aria-hidden="true" />
            <Typography sx={techLabelStyle}>DATA</Typography>
          </Stack>
          <Chip
            label={`${totalInputs} inputs`}
            size="small"
            sx={{ height: 32, fontSize: '0.875rem', fontWeight: 600, bgcolor: tokens.accent[50], color: tokens.accent[700] }}
          />
        </Stack>

        <Divider />

        {/* INPUTS BY STEP Section */}
        <Stack spacing={2}>
          <Typography sx={techLabelStyle}>INPUTS BY STEP</Typography>

          {sortedFiles.length === 0 ? (
            <Box sx={{ p: 2, bgcolor: tokens.neutral[50], borderRadius: tokens.radius.md, border: `1px dashed ${tokens.neutral[200]}` }}>
              <Typography variant="caption" color="text.secondary">No files added yet</Typography>
            </Box>
          ) : (
            sortedFiles.map((file) => {
              const metadata = filesMetadata[file.file_path];
              const inputs = metadata?.inputs || [];
              const filename = file.file_path.split('\\').pop() || file.file_path.split('/').pop() || file.file_path;

              return (
                <Stack key={file.file_path} spacing={1}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {isMobile ? `Step ${file.position}` : `Step ${file.position}: ${filename}`}
                  </Typography>

                  {inputs.length === 0 ? (
                    <Box sx={{ p: 1.5, bgcolor: tokens.neutral[50], borderRadius: tokens.radius.md, border: `1px dashed ${tokens.neutral[200]}` }}>
                      <Typography variant="caption" color="text.secondary">No inputs found</Typography>
                    </Box>
                  ) : (
                    <Stack spacing={0.5}>
                      {inputs.map((inputDef) => {
                        const inputConfig = file.inputs.find(i => i.alias === inputDef.alias);
                        const inputType = inputConfig ? detectInputType(inputConfig.value) : 'numeric';
                        const status = inputConfig
                          ? getValueStatus(inputConfig, file.file_path, inputDef.alias, mappings)
                          : { type: 'unconfigured' as const, text: '(unconfigured)' };

                        return (
                          <MuiBentoCard
                            key={inputDef.alias}
                            onClick={() => onInputClick?.(file.position, inputDef.alias)}
                            sx={{
                              p: 1.5,
                              cursor: onInputClick ? 'pointer' : 'default',
                              backgroundColor: status.type === 'unconfigured' ? tokens.neutral[50] : 'background.paper',
                              borderLeft: `3px solid ${
                                status.type === 'mapping'
                                  ? tokens.accent[500]
                                  : status.type === 'value'
                                  ? tokens.success.main
                                  : tokens.neutral[300]
                              }`,
                              transition: `all ${tokens.transition.normal}`,
                              '&:hover': {
                                boxShadow: tokens.shadow.md,
                                borderColor: tokens.accent[500],
                              }
                            }}
                          >
                            <Stack spacing={0.5}>
                              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                  <Typography variant="caption" sx={{ fontFamily: tokens.fontStack.mono, fontWeight: 700, color: tokens.accent[500] }}>
                                    {inputDef.alias}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {inputDef.name}
                                  </Typography>
                                </Stack>
                                <Chip
                                  label={inputType}
                                  size="small"
                                  sx={{ height: 32, fontSize: '0.875rem', bgcolor: inputType === 'numeric' ? tokens.accent[50] : tokens.primary[50], color: inputType === 'numeric' ? tokens.accent[700] : tokens.primary[700] }}
                                />
                              </Stack>

                              <Stack direction="row" spacing={0.5} alignItems="center">
                                {status.type === 'mapping' ? (
                                  <>
                                    <IconLink size={12} color={tokens.accent[500]} aria-hidden="true" />
                                    <Typography variant="caption" sx={{ color: tokens.accent[500], fontFamily: tokens.fontStack.mono, fontSize: '0.875rem' }}>
                                      {status.text}
                                    </Typography>
                                  </>
                                ) : status.type === 'value' ? (
                                  <Typography variant="caption" sx={{ color: tokens.success.dark, fontFamily: tokens.fontStack.mono, fontSize: '0.875rem' }}>
                                    {status.text}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                    {status.text}
                                  </Typography>
                                )}
                              </Stack>
                            </Stack>
                          </MuiBentoCard>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              );
            })
          )}
        </Stack>

        {mappings.length > 0 && (
          <>
            <Divider />

            {/* MAPPING CHAINS Section */}
            <Stack spacing={2}>
              <Typography sx={techLabelStyle}>MAPPING CHAINS</Typography>

              {Object.entries(mappingsBySource).map(([sourceFile, fileMappings]) => (
                <Stack key={sourceFile} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconDatabase size={14} color={tokens.neutral[500]} aria-hidden="true" />
                    <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                      From: {sourceFile.split('\\').pop() || sourceFile}
                    </Typography>
                  </Stack>

                  {fileMappings.map((mapping, idx) => (
                    <MuiBentoCard
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const targetFile = files.find(f => f.file_path === mapping.target_file);
                        if (targetFile && onInputClick) {
                          onInputClick(targetFile.position, mapping.target_alias);
                        }
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const targetFile = files.find(f => f.file_path === mapping.target_file);
                          if (targetFile && onInputClick) {
                            onInputClick(targetFile.position, mapping.target_alias);
                          }
                        }
                      }}
                      sx={{
                        p: 1.5,
                        cursor: onInputClick ? 'pointer' : 'default',
                        backgroundColor: tokens.neutral[50],
                        transition: `all ${tokens.transition.normal}`,
                        '&:hover': {
                          borderColor: tokens.accent[500],
                          boxShadow: tokens.shadow.md,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${tokens.primary[700]}`,
                          outlineOffset: '2px',
                        },
                        textAlign: 'left',
                        width: '100%',
                        border: `1px solid ${tokens.neutral[200]}`,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: tokens.fontStack.mono, color: tokens.accent[600], display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={`Source: ${sourceFile}`}
                          >
                            {mapping.source_alias}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: tokens.neutral[500] }}>
                            {sourceFile.split('\\').pop() || sourceFile}
                          </Typography>
                        </Box>
                        <IconArrowRight size={14} color={tokens.accent[500]} aria-hidden="true" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: tokens.fontStack.mono, color: tokens.primary[700], display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={`Target: ${mapping.target_file}`}
                          >
                            {mapping.target_alias}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: tokens.neutral[500] }}>
                            {mapping.target_file.split('\\').pop() || mapping.target_file}
                          </Typography>
                        </Box>
                        {mapping.units && (
                          <Chip label={mapping.units} size="small" sx={{ height: 44, minHeight: 44, fontSize: '0.875rem' }} />
                        )}
                      </Stack>
                    </MuiBentoCard>
                  ))}
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
