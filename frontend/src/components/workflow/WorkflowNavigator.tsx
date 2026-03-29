/**
 * WorkflowNavigator.tsx
 * Vertical step navigation dock for workflow steps.
 *
 * This component renders a vertical sidebar with clickable step tabs,
 * arrow navigation controls, and visual indicators for step states.
 *
 * @module components/workflow/WorkflowNavigator
 */

import {
  Stack,
  Box,
  Typography,
  ButtonBase,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import { useRef, useEffect, useCallback } from 'react';
import type {
  WorkflowNavigatorProps,
  NavigatorStep,
  NavigatorState,
  NavigatorPalette,
} from './WorkflowTypes';
import { tokens } from '../../theme/mui-theme';

// Jade color tokens for navigator styling
const jade = {
  strong: tokens.primary[700],
  medium: tokens.primary[600],
  soft: tokens.primary[100],
  muted: tokens.neutral[300],
  surface: tokens.neutral[50],
  ink: tokens.neutral[900],
};

/**
 * Default palette generator for navigator steps.
 * Maps step state to visual styling.
 */
const getDefaultPalette = (
  state: NavigatorState,
  isSelected: boolean
): NavigatorPalette => {
  if (state === 'error') {
    return {
      border: tokens.error.border,
      background: tokens.error.light,
      text: tokens.error.dark,
      connector: tokens.error.border,
      shadow: 'none',
    };
  }

  return state === 'complete'
    ? {
        border: jade.strong,
        background: jade.strong,
        text: tokens.neutral[0],
        connector: jade.medium,
        shadow: isSelected ? `0 8px 20px ${tokens.alpha.primary[20]}` : 'none',
      }
    : {
        border: jade.soft,
        background: tokens.neutral[0],
        text: jade.ink,
        connector: jade.muted,
        shadow: isSelected ? `0 8px 20px ${tokens.alpha.neutral[12]}` : 'none',
      };
};

/**
 * WorkflowNavigator Component
 *
 * A vertical dock displaying workflow steps with navigation controls.
 * Supports keyboard navigation, scroll-to-view, and visual state indicators.
 *
 * @param props - WorkflowNavigatorProps
 */
export const WorkflowNavigator: React.FC<WorkflowNavigatorProps> = ({
  steps,
  activeStepIndex,
  onStepSelect,
  executionStepIndex = null,
  getStepLabel,
  getStepState,
  getStepPalette,
  disabled = false,
  stepRefs: externalStepRefs,
}) => {
  // Internal refs if not provided externally
  const internalStepRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const stepRefs = externalStepRefs ?? internalStepRefs;

  // Scroll active step into view
  useEffect(() => {
    const target = stepRefs.current[activeStepIndex];
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeStepIndex, stepRefs]);

  // Navigation handlers
  const handleStepClick = useCallback(
    (index: number) => {
      if (disabled || steps.length === 0) {
        return;
      }
      onStepSelect(index);
    },
    [disabled, steps.length, onStepSelect]
  );

  const handlePrevClick = useCallback(() => {
    if (disabled || activeStepIndex <= 0) {
      return;
    }
    onStepSelect(activeStepIndex - 1);
  }, [disabled, activeStepIndex, onStepSelect]);

  const handleNextClick = useCallback(() => {
    if (disabled || activeStepIndex >= steps.length - 1) {
      return;
    }
    onStepSelect(activeStepIndex + 1);
  }, [disabled, activeStepIndex, steps.length, onStepSelect]);

  const canGoPrev = activeStepIndex > 0 && !disabled;
  const canGoNext = activeStepIndex < steps.length - 1 && !disabled;

  // Use provided palette getter or default
  const resolveStepPalette = useCallback(
    (step: NavigatorStep, state: NavigatorState, isSelected: boolean) => {
      if (getStepPalette) {
        return getStepPalette(step, state, isSelected);
      }
      return getDefaultPalette(state, isSelected);
    },
    [getStepPalette]
  );

  if (steps.length === 0) {
    return null;
  }

  return (
    <Stack
      direction="column"
      spacing={0.5}
      alignItems="center"
      sx={{
        width: '100%',
        py: 1,
      }}
      role="tablist"
      aria-label="Workflow step dock"
    >
      {/* Up arrow navigation */}
      <IconButton
        onClick={handlePrevClick}
        disabled={!canGoPrev}
        aria-label="Previous step"
        sx={{
          width: 40,
          height: 40,
          border: `1px solid ${canGoPrev ? jade.soft : tokens.neutral[200]}`,
          color: canGoPrev ? jade.medium : tokens.neutral[400],
          backgroundColor: tokens.neutral[0],
          '&:hover': {
            borderColor: jade.medium,
            backgroundColor: tokens.primary[50],
          },
          '&.Mui-disabled': {
            borderColor: tokens.neutral[200],
            color: tokens.neutral[400],
          },
        }}
      >
        <KeyboardArrowUpIcon fontSize="small" />
      </IconButton>

      {/* Step tabs container */}
      <Box
        sx={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 0.5,
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: jade.soft,
            borderRadius: tokens.radius.full,
          },
        }}
      >
        <Stack
          direction="column"
          spacing={0}
          sx={{ alignItems: 'center', width: '100%' }}
        >
          {steps.map((step, index) => {
            const state = getStepState(step, index);
            const isSelected = activeStepIndex === index;
            const isExecuting = executionStepIndex === index;
            const palette = resolveStepPalette(step, state, isSelected);

            return (
              <Stack
                key={
                  step.type === 'result'
                    ? `result-${index}`
                    : `${step.type}-${index}-${step.data.file_path}`
                }
                direction="column"
                alignItems="center"
                sx={{ flexShrink: 0, width: '100%' }}
              >
                <Tooltip title={getStepLabel(step, index)} arrow placement="right">
                  <ButtonBase
                    ref={(node: HTMLButtonElement | null) => {
                      stepRefs.current[index] = node;
                    }}
                    onClick={() => handleStepClick(index)}
                    disabled={disabled}
                    aria-label={`Jump to step ${index + 1}: ${getStepLabel(step, index)}`}
                    aria-current={isSelected ? 'step' : undefined}
                    aria-pressed={isSelected}
                    role="tab"
                    sx={{
                      position: 'relative',
                      width: { xs: 30, sm: 36 },
                      height: { xs: 30, sm: 36 },
                      borderRadius: '50%',
                      border: `1px solid ${palette.border}`,
                      backgroundColor: palette.background,
                      color: palette.text,
                      transition:
                        'border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: isExecuting
                        ? `0 0 0 3px ${tokens.alpha.primary[20]}`
                        : palette.shadow,
                      '&:hover': {
                        backgroundColor: palette.background,
                        borderColor: palette.border,
                        transform: 'translateY(-1px)',
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${jade.medium}`,
                        outlineOffset: '2px',
                      },
                      '&::after': isSelected
                        ? {
                            content: '""',
                            position: 'absolute',
                            inset: -4,
                            borderRadius: '50%',
                            border: `2px solid ${palette.border}`,
                            opacity: 0.22,
                          }
                        : undefined,
                      '&.Mui-disabled': {
                        cursor: 'not-allowed',
                        opacity: 0.5,
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 800,
                        fontSize: { xs: '0.85rem', sm: '0.9rem' },
                        color: 'inherit',
                      }}
                    >
                      {step.type === 'result' ? 'R' : index + 1}
                    </Typography>
                  </ButtonBase>
                </Tooltip>

                {/* Connector line between steps */}
                {index < steps.length - 1 && (
                  <Box
                    aria-hidden
                    sx={{
                      width: 3,
                      height: { xs: 16, sm: 20 },
                      borderRadius: tokens.radius.full,
                      backgroundColor: palette.connector,
                      flexShrink: 0,
                    }}
                  />
                )}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      {/* Down arrow navigation */}
      <IconButton
        onClick={handleNextClick}
        disabled={!canGoNext}
        aria-label="Next step"
        sx={{
          width: 40,
          height: 40,
          border: `1px solid ${canGoNext ? jade.soft : tokens.neutral[200]}`,
          color: canGoNext ? jade.medium : tokens.neutral[400],
          backgroundColor: tokens.neutral[0],
          '&:hover': {
            borderColor: jade.medium,
            backgroundColor: tokens.primary[50],
          },
          '&.Mui-disabled': {
            borderColor: tokens.neutral[200],
            color: tokens.neutral[400],
          },
        }}
      >
        <KeyboardArrowDownIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
};

export default WorkflowNavigator;
