import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Pause as PauseIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { openFile, WorkflowStatus } from '../../services/api';
import type {
  InputValue,
  WorkflowCreatedFile,
  WorkflowResultSummary,
  WorkflowStatusResponse,
  StepResult,
} from '../../services/api';
import type { CreatedFilesByStep } from './WorkflowTypes';
import iStyles from '../../styles/industrial.module.css';
import { tokens } from '../../theme/mui-theme';
import { WorkflowIterationTable } from './WorkflowIterationTable';
import { WorkflowCsvResults } from './WorkflowCsvResults';
import styles from './WorkflowResultView.module.css';

export interface WorkflowResultViewProps {
  workflowStatus?: WorkflowStatusResponse | null;
  progress: number;
  createdFiles: WorkflowCreatedFile[];
  resultSummary: WorkflowResultSummary | null;
  isEmptyState: boolean;
  onOpenFile?: (path: string) => void;
  onRunWorkflow?: () => void;
  onPauseWorkflow?: () => void;
  onResumeWorkflow?: () => void;
  onStopWorkflow?: () => void;
  onResumeFromCheckpoint?: () => void;
  isRunning?: boolean;
  isPausing?: boolean;
  isResuming?: boolean;
  isStopping?: boolean;
  currentExecutionLabel?: string;
  completedCount?: number;
  totalSteps?: number;
}

type IterationGroup = {
  iterationIndex: number;
  steps: StepResult[];
  hasFailure: boolean;
  hasErrorCode6: boolean;
};

const toDisplayIteration = (iterationIndex: number | null | undefined): number => {
  if (iterationIndex === null || iterationIndex === undefined) return 1;
  return iterationIndex <= 0 ? iterationIndex + 1 : iterationIndex;
};

function groupFilesByStep(createdFiles: WorkflowCreatedFile[]): CreatedFilesByStep[] {
  const groups = new Map<string, WorkflowCreatedFile[]>();
  createdFiles.forEach((file) => {
    const key = `${file.step_index}:${file.step_name}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(file);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries()).map(([key, filesForStep]) => ({
    key,
    stepIndex: filesForStep[0]?.step_index ?? 0,
    stepName: filesForStep[0]?.step_name ?? 'Step',
    files: filesForStep,
  }));
}

function getIterationGroups(stepResults: StepResult[]): IterationGroup[] {
  const grouped = new Map<number, StepResult[]>();
  stepResults.forEach((step) => {
    const idx = step.iteration_index ?? 0;
    const bucket = grouped.get(idx) ?? [];
    bucket.push(step);
    grouped.set(idx, bucket);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([iterationIndex, steps]) => {
      const sortedSteps = [...steps].sort((a, b) => a.step_index - b.step_index);
      const hasFailure = sortedSteps.some((step) => step.status === 'failed' || Boolean(step.error));
      const hasErrorCode6 = sortedSteps.some((step) => {
        const detail = `${step.error ?? ''} ${step.error_detail ?? ''}`.toLowerCase();
        return detail.includes('errorcode 6');
      });
      return {
        iterationIndex,
        steps: sortedSteps,
        hasFailure,
        hasErrorCode6,
      };
    });
}

function getDisplayName(path: string | undefined): string {
  if (!path) return 'Worksheet.mcdx';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || 'Worksheet.mcdx';
}

function formatValue(value: InputValue): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'N/A';
    return value.map((entry) => String(entry)).join(', ');
  }
  return String(value);
}

function formatValueWithUnit(value: InputValue, unit?: string | null): string {
  const base = formatValue(value);
  if (!unit || base === 'N/A') return base;
  return `${base} ${unit}`;
}

function toDisplayAlias(alias: string): string {
  // Backend stores mapped inputs as "N.alias" to preserve source step provenance.
  // For iteration cards we want user-facing aliases only.
  const match = alias.match(/^\d+\.(.+)$/);
  return match ? match[1] : alias;
}

function pickParameterPreview(step?: StepResult): Array<{ alias: string; value: string }> {
  if (!step?.inputs) return [];

  const entries = Object.entries(step.inputs).filter(
    ([alias]) => alias.toLowerCase() !== 'experimental_input'
  );
  if (entries.length === 0) return [];

  const normalized = new Map(
    entries.map(([alias, value]) => [toDisplayAlias(alias).toLowerCase(), { alias, value }])
  );
  const preferredAliases = ['p', 'a'];
  const selected: Array<{ alias: string; value: string }> = [];

  preferredAliases.forEach((alias) => {
    const match = normalized.get(alias);
    if (match) {
      selected.push({
        alias: toDisplayAlias(match.alias),
        value: formatValueWithUnit(match.value, step.input_units?.[match.alias]),
      });
    }
  });

  entries
    .filter(([alias]) => alias.toLowerCase().includes('beam'))
    .forEach(([alias, value]) => {
      if (!selected.some((item) => item.alias === alias)) {
        selected.push({ alias: toDisplayAlias(alias), value: formatValueWithUnit(value, step.input_units?.[alias]) });
      }
    });

  if (selected.length >= 3) {
    return selected.slice(0, 3);
  }

  entries.forEach(([alias, value]) => {
    const displayAlias = toDisplayAlias(alias);
    if (!selected.some((item) => item.alias === displayAlias)) {
      selected.push({ alias: displayAlias, value: formatValueWithUnit(value, step.input_units?.[alias]) });
    }
  });

  return selected.slice(0, 3);
}

function normalizeFileToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

function buildIterationFileMatchers(step?: StepResult): RegExp[] {
  if (!step?.inputs) return [];
  const matchers: RegExp[] = [];
  Object.entries(step.inputs).forEach(([alias, rawValue]) => {
    if (alias.toLowerCase() === 'experimental_input') return;
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    if (Array.isArray(rawValue)) return;

    const value = normalizeFileToken(String(rawValue));
    const key = normalizeFileToken(toDisplayAlias(alias));
    if (!value || !key) return;

    // Match patterns like tp-0.5, tp_0.5, tp0.5 in file names/paths.
    matchers.push(new RegExp(`${key}[-_]?${value}`));
  });
  return matchers;
}

export const WorkflowResultView = ({
  workflowStatus,
  progress,
  createdFiles,
  resultSummary,
  isEmptyState,
  onOpenFile,
  onPauseWorkflow,
  onResumeWorkflow,
  onStopWorkflow,
  onResumeFromCheckpoint,
  isRunning = false,
  isPausing = false,
  isResuming = false,
  isStopping = false,
  completedCount = 0,
  totalSteps = 0,
}: WorkflowResultViewProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [selectedIterationIndex, setSelectedIterationIndex] = useState<number | null>(null);
  const [selectedCsvStepIndex, setSelectedCsvStepIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileOpenStatus, setFileOpenStatus] = useState<string | null>(null);

  const resultProgress = Math.max(0, Math.min(100, progress));

  const resultSummaryLabel = useMemo(() => {
    if (!resultSummary) {
      return `${completedCount}/${Math.max(0, totalSteps)} steps`;
    }

    if (resultSummary.total_iterations > 1) {
      return `${resultSummary.completed_iterations}/${resultSummary.total_iterations} iterations`;
    }

    return `${resultSummary.completed_steps}/${resultSummary.total_steps} steps`;
  }, [completedCount, totalSteps, resultSummary]);

  const hasMultipleIterations = resultSummary && resultSummary.total_iterations > 1;

  const resultSummaryDetail = useMemo(() => {
    if (!resultSummary || resultSummary.total_iterations <= 1 || resultSummary.total_steps <= 0) {
      return null;
    }
    return `${resultSummary.total_steps} steps per iteration`;
  }, [resultSummary]);

  const iterationGroups = useMemo(
    () => getIterationGroups(Array.isArray(workflowStatus?.step_results) ? (workflowStatus.step_results as StepResult[]) : []),
    [workflowStatus?.step_results]
  );

  useEffect(() => {
    if (iterationGroups.length === 0) {
      setSelectedIterationIndex(null);
      return;
    }

    const existing = iterationGroups.some((group) => group.iterationIndex === selectedIterationIndex);
    if (!existing) {
      setSelectedIterationIndex(iterationGroups[0].iterationIndex);
    }
  }, [iterationGroups, selectedIterationIndex]);

  const selectedIteration = useMemo(() => {
    if (selectedIterationIndex === null) return null;
    return iterationGroups.find((group) => group.iterationIndex === selectedIterationIndex) ?? null;
  }, [iterationGroups, selectedIterationIndex]);

  useEffect(() => {
    setSelectedCsvStepIndex(null);
  }, [selectedIterationIndex]);

  const selectedSteps = selectedIteration?.steps ?? [];
  const selectedIterationIds = useMemo(() => {
    return new Set(
      selectedSteps
        .map((step) => step.iteration_id)
        .filter((value): value is string => Boolean(value))
    );
  }, [selectedSteps]);

  const hasReliableIterationIds = useMemo(() => {
    const allSteps = Array.isArray(workflowStatus?.step_results) ? (workflowStatus.step_results as StepResult[]) : [];
    const allIterationGroups = getIterationGroups(allSteps);
    if (allIterationGroups.length <= 1) return true;
    const ids = new Set(allSteps.map((step) => step.iteration_id).filter((value): value is string => Boolean(value)));
    // If multiple iterations share one id, frontend must fall back to heuristic matching.
    return ids.size >= allIterationGroups.length;
  }, [workflowStatus?.step_results]);

  const selectedStepMatchers = useMemo(
    () =>
      selectedSteps.map((step) => ({
        stepIndex: step.step_index,
        matchers: buildIterationFileMatchers(step),
      })),
    [selectedSteps]
  );

  const createdFilesByStep = useMemo(() => {
    const matchByStepHeuristics = (files: WorkflowCreatedFile[]) =>
      files.filter((file) => {
        const stepMatcher = selectedStepMatchers.find((entry) => entry.stepIndex === file.step_index);
        if (!stepMatcher) return false;
        if (stepMatcher.matchers.length === 0) {
          return iterationGroups.length <= 1;
        }
        const target = `${file.name} ${file.path}`.toLowerCase();
        return stepMatcher.matchers.some((pattern) => pattern.test(target));
      });

    if (selectedIterationIds.size === 0) {
      return groupFilesByStep(matchByStepHeuristics(createdFiles));
    }

    const explicit = createdFiles.filter((file) => file.iteration_id && selectedIterationIds.has(file.iteration_id));
    if (hasReliableIterationIds) {
      return groupFilesByStep(explicit);
    }

    // Keep trusted explicit iteration matches; use heuristics only for files with no iteration id.
    const missingIterationId = createdFiles.filter((file) => !file.iteration_id);
    const heuristic = matchByStepHeuristics(missingIterationId);
    const merged = [...explicit, ...heuristic];
    return groupFilesByStep(merged);
  }, [createdFiles, selectedIterationIds, hasReliableIterationIds, selectedStepMatchers, iterationGroups.length]);

  const runDiagnostics = useMemo(
    () =>
      selectedSteps
        .filter((step) => step.error || step.error_detail)
        .map((step) => ({
          stepIndex: step.step_index,
          stepName: getDisplayName(step.file_path),
          error: step.error,
          detail: step.error_detail,
        })),
    [selectedSteps]
  );

  const handleOpenCreatedFile = async (path: string) => {
    const fileName = path.split(/[/\\]/).pop() ?? path;
    setFileOpenStatus(`Opening ${fileName}…`);
    try {
      if (onOpenFile) {
        onOpenFile(path);
        setFileOpenStatus(`Opened ${fileName}`);
      } else {
        await openFile(path);
        setFileOpenStatus(`Opened ${fileName}`);
      }
    } catch {
      setFileOpenStatus(`Failed to open ${fileName}`);
    } finally {
      setTimeout(() => setFileOpenStatus(null), 3000);
    }
  };

  const sidebar = (
    <Stack className={styles.sidebarRail} spacing={1.5} role="navigation" aria-label="Result run list">
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: tokens.primary[600],
          boxShadow: `0 0 8px ${tokens.primary[400]}`
        }} />
        <Typography className={iStyles.techLabel} sx={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>
          RUNS
        </Typography>
      </Stack>
      {iterationGroups.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.neutral[500], fontSize: '0.9rem', pl: 1 }}>
          Run cards appear after step results are available.
        </Typography>
      ) : (
        iterationGroups.map((group) => {
          const selected = group.iterationIndex === selectedIterationIndex;
          const preview = pickParameterPreview(group.steps[group.steps.length - 1]);

          return (
            <Button
              key={`iter-${group.iterationIndex}`}
              className={`${styles.runCard} ${selected ? styles.runCardSelected : ''}`}
              onClick={() => {
                setSelectedIterationIndex(group.iterationIndex);
                setDrawerOpen(false);
              }}
              aria-label={`Iteration ${toDisplayIteration(group.iterationIndex)}`}
            >
              <Stack spacing={1} sx={{ width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={0.85} alignItems="center">
                    {group.hasFailure ? (
                      <Box sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: tokens.error.main,
                        boxShadow: `0 0 6px ${tokens.error.light}`
                      }} />
                    ) : (
                      <Box sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: tokens.success.main,
                        boxShadow: `0 0 6px ${tokens.success.light}`
                      }} />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.neutral[900], fontSize: '0.95rem' }}>
                      Iteration {toDisplayIteration(group.iterationIndex)}
                    </Typography>
                  </Stack>
                  <Typography className={styles.stepCountBadge}>
                    {group.steps.length} steps
                  </Typography>
                </Stack>

                {group.hasErrorCode6 && (
                  <Chip
                    label="ErrorCode 6"
                    size="small"
                    className={styles.errorCodeBadge}
                  />
                )}

                <Stack spacing={0.5}>
                  {preview.length === 0 ? (
                    <Typography variant="caption" sx={{ color: tokens.neutral[500], fontSize: '0.75rem' }}>
                      No parameter snapshot
                    </Typography>
                  ) : (
                    preview.map((entry) => (
                      <Stack key={entry.alias} direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" className={styles.previewAlias}>
                          {entry.alias}
                        </Typography>
                        <Typography variant="caption" className={styles.previewValue}>
                          {entry.value}
                        </Typography>
                      </Stack>
                    ))
                  )}
                </Stack>
              </Stack>
            </Button>
          );
        })
      )}
    </Stack>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.neutral[200]}`,
        overflow: 'visible',
        backgroundColor: tokens.surface.paper,
      }}
    >
      <LinearProgress
        variant="determinate"
        value={resultProgress}
        sx={{
          height: 5,
          bgcolor: tokens.neutral[100],
          '& .MuiLinearProgress-bar': {
            backgroundColor:
              workflowStatus?.status === WorkflowStatus.FAILED
                ? tokens.error.dark
                : workflowStatus?.status === WorkflowStatus.COMPLETED
                  ? tokens.success.dark
                  : tokens.primary[700],
          },
        }}
      />

      <Box className={styles.shellLayout}>
        {isDesktop ? (
          sidebar
        ) : (
          <Stack sx={{ px: 2, pt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setDrawerOpen(true)}
              sx={{ width: 'fit-content', textTransform: 'none' }}
            >
              Open run list
            </Button>
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              aria-modal="true"
              role="dialog"
              aria-label="Iteration list"
              PaperProps={{ sx: { width: 300 } }}
            >
              <Box sx={{ p: 2 }}>{sidebar}</Box>
            </Drawer>
          </Stack>
        )}

        <Stack spacing={2} className={styles.workspacePane}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'center' }}
          >
            <Stack spacing={1}>
              {!isEmptyState && (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  {hasMultipleIterations ? (
                    <span className={styles.iterationBadge}>
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: tokens.primary[600]
                      }} />
                      {resultSummaryLabel}
                    </span>
                  ) : (
                    <Typography sx={{ fontWeight: 700, color: tokens.neutral[800], fontSize: '1rem' }}>
                      {resultSummaryLabel}
                    </Typography>
                  )}
                  {resultSummaryDetail && (
                    <Typography sx={{ color: tokens.neutral[500], fontSize: '0.9rem' }}>
                      {resultSummaryDetail}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {isRunning && onPauseWorkflow && (
                <Button variant="text" startIcon={<PauseIcon />} onClick={onPauseWorkflow} disabled={isPausing} sx={{ minHeight: 40, borderRadius: '99px', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                  Pause
                </Button>
              )}
              {workflowStatus?.status === WorkflowStatus.PAUSED && onResumeWorkflow && (
                <Button variant="text" startIcon={<CheckCircleIcon />} onClick={onResumeWorkflow} disabled={isResuming} sx={{ minHeight: 40, borderRadius: '99px', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                  Resume
                </Button>
              )}
              {(isRunning || workflowStatus?.status === WorkflowStatus.PAUSED) && onStopWorkflow && (
                <Button variant="text" color="error" startIcon={<StopIcon />} onClick={onStopWorkflow} disabled={isStopping} sx={{ minHeight: 40, borderRadius: '99px', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                  Cancel
                </Button>
              )}
              {workflowStatus?.status === WorkflowStatus.FAILED && workflowStatus.checkpoint_path && onResumeFromCheckpoint && (
                <Button variant="text" startIcon={<RefreshIcon />} onClick={onResumeFromCheckpoint} sx={{ minHeight: 40, borderRadius: '99px', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                  Recover
                </Button>
              )}
            </Stack>
          </Stack>

          <Stack spacing={1.5}>
            {runDiagnostics.length > 0 && (
              <Stack component="ul" role="list" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {runDiagnostics.map((item) => (
                  <Alert
                    key={`${item.stepIndex}-${item.stepName}`}
                    severity="error"
                    variant="outlined"
                    component="li"
                    aria-label={`Error in step ${item.stepIndex + 1}: ${item.stepName}`}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {`Step ${item.stepIndex + 1} (${item.stepName})`}
                      </Typography>
                      {item.error && <Typography variant="body2">{item.error}</Typography>}
                      {item.detail && <Typography variant="body2">{item.detail}</Typography>}
                    </Stack>
                  </Alert>
                ))}
              </Stack>
            )}
            <Box className={styles.executionTableSticky}>
              <WorkflowIterationTable
                stepResults={selectedSteps}
                onStepSelect={(stepIndex) => setSelectedCsvStepIndex(stepIndex)}
              />
            </Box>
            <WorkflowCsvResults
              stepResults={selectedSteps}
              selectedStepIndex={selectedCsvStepIndex}
            />
          </Stack>

          <Stack spacing={1.5}>
            {fileOpenStatus && (
              <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{ fontSize: '0.85rem', color: tokens.primary[700], fontWeight: 600 }}
              >
                {fileOpenStatus}
              </Box>
            )}
            {createdFilesByStep.length > 0 && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FolderOpenIcon sx={{ fontSize: 20, color: tokens.primary[600] }} />
                <Typography className={iStyles.techLabel} sx={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>CREATED FILES</Typography>
              </Stack>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<PdfIcon sx={{ fontSize: 16 }} />}
                label={`${resultSummary?.pdf_count ?? createdFiles.filter((file) => file.format === 'pdf').length} PDFs`}
                size="small"
                variant="outlined"
                color="error"
                sx={{ fontWeight: 600, fontSize: '0.85rem' }}
              />
              {((resultSummary?.mcdx_count ?? createdFiles.filter((file) => file.format === 'mcdx').length) > 0) && (
                <Chip
                  icon={<DescriptionIcon sx={{ fontSize: 16 }} />}
                  label={`${resultSummary?.mcdx_count ?? createdFiles.filter((file) => file.format === 'mcdx').length} MCDX`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                />
              )}
            </Stack>

            {createdFilesByStep.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                No exported files are available for this run yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {createdFilesByStep.map((group) => (
                  <Paper
                    key={group.key}
                    variant="outlined"
                    sx={{
                      borderRadius: tokens.radius.md,
                      p: 2,
                      backgroundColor: tokens.neutral[0],
                      borderLeft: `3px solid ${tokens.primary[300]}`,
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Typography sx={{ fontWeight: 700, color: tokens.neutral[900], fontSize: '0.95rem' }}>
                        Step {group.stepIndex + 1}: {group.stepName}
                      </Typography>
                      <Stack spacing={0.85}>
                        {group.files.map((file) => (
                          <Button
                            key={file.path}
                            variant="text"
                            onClick={() => handleOpenCreatedFile(file.path)}
                            sx={{
                              justifyContent: 'space-between',
                              textTransform: 'none',
                              borderRadius: tokens.radius.md,
                              px: 1.5,
                              py: 1,
                              color: tokens.neutral[800],
                              backgroundColor: file.format === 'pdf' ? tokens.error.light : tokens.surface.paper,
                              border: `1px solid ${file.format === 'pdf' ? tokens.error.border : tokens.neutral[200]}`,
                              transition: 'all 200ms ease',
                              '&:hover': {
                                backgroundColor: file.format === 'pdf' ? tokens.error.light : tokens.primary[50],
                                borderColor: file.format === 'pdf' ? tokens.error.main : tokens.primary[300],
                                transform: 'translateX(2px)',
                              },
                            }}
                          >
                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                              {file.format === 'pdf' ? (
                                <PdfIcon sx={{ fontSize: 20, color: tokens.error.dark }} />
                              ) : file.format === 'mcdx' ? (
                                <DescriptionIcon sx={{ fontSize: 20, color: tokens.primary[700] }} />
                              ) : (
                                <FileIcon sx={{ fontSize: 20, color: tokens.neutral[500] }} />
                              )}
                              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }} noWrap>
                                {file.name}
                              </Typography>
                            </Stack>
                            <Chip
                              label={file.format.toUpperCase()}
                              size="small"
                              color={file.format === 'pdf' ? 'error' : file.format === 'mcdx' ? 'primary' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
};

export default WorkflowResultView;
