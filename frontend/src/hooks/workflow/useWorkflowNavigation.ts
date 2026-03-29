/**
 * useWorkflowNavigation.ts
 * Custom hook for managing workflow step navigation state and logic.
 *
 * This hook encapsulates all navigation-related state and functions used by
 * WorkflowView, making the navigation logic reusable and testable.
 *
 * @module hooks/workflow/useWorkflowNavigation
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Configuration options for the workflow navigation hook.
 */
export interface UseWorkflowNavigationOptions {
  /** Initial step index (defaults to 0) */
  initialStep?: number;
  /** Total number of steps in the workflow */
  totalSteps: number;
  /** Whether navigation is disabled */
  disabled?: boolean;
}

/**
 * Return type for the workflow navigation hook.
 */
export interface UseWorkflowNavigationReturn {
  /** Current step index */
  current: number;
  /** Navigate to a specific step by index */
  goTo: (index: number) => void;
  /** Navigate to the next step (if available) */
  goToNext: () => void;
  /** Navigate to the previous step (if available) */
  goToPrev: () => void;
  /** Directly set the current step index (without bounds checking) */
  setCurrent: (index: number) => void;
  /** Whether there is a previous step available */
  canGoPrev: boolean;
  /** Whether there is a next step available */
  canGoNext: boolean;
  /** Total number of steps */
  totalSteps: number;
}

/**
 * Custom hook for managing workflow step navigation.
 *
 * Provides navigation state and functions for moving between steps in a workflow.
 * Handles bounds checking and disabled state.
 *
 * @param options - Configuration options for the navigation hook
 * @returns Navigation state and control functions
 *
 * @example
 * ```tsx
 * const navigation = useWorkflowNavigation({
 *   initialStep: 0,
 *   totalSteps: 5,
 * });
 *
 * // Navigate to a specific step
 * navigation.goTo(2);
 *
 * // Go to next step
 * navigation.goToNext();
 *
 * // Check if navigation is possible
 * if (navigation.canGoNext) {
 *   navigation.goToNext();
 * }
 * ```
 */
export function useWorkflowNavigation(
  options: UseWorkflowNavigationOptions
): UseWorkflowNavigationReturn {
  const { initialStep = 0, totalSteps, disabled = false } = options;

  // Internal state for current step index
  const [current, setCurrent] = useState(initialStep);

  /**
   * Navigate to a specific step by index.
   * Performs bounds checking to ensure the index is valid.
   */
  const goTo = useCallback(
    (index: number) => {
      if (disabled || totalSteps === 0) {
        return;
      }

      // Clamp index to valid range [0, totalSteps - 1]
      const clampedIndex = Math.max(0, Math.min(index, totalSteps - 1));
      setCurrent(clampedIndex);
    },
    [disabled, totalSteps]
  );

  /**
   * Navigate to the next step.
   * Does nothing if already at the last step or disabled.
   */
  const goToNext = useCallback(() => {
    if (disabled) {
      return;
    }
    setCurrent((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [disabled, totalSteps]);

  /**
   * Navigate to the previous step.
   * Does nothing if already at the first step or disabled.
   */
  const goToPrev = useCallback(() => {
    if (disabled) {
      return;
    }
    setCurrent((prev) => Math.max(prev - 1, 0));
  }, [disabled]);

  /**
   * Whether there is a previous step available.
   */
  const canGoPrev = useMemo(() => current > 0 && !disabled, [current, disabled]);

  /**
   * Whether there is a next step available.
   */
  const canGoNext = useMemo(
    () => current < totalSteps - 1 && !disabled,
    [current, totalSteps, disabled]
  );

  return {
    current,
    goTo,
    goToNext,
    goToPrev,
    setCurrent,
    canGoPrev,
    canGoNext,
    totalSteps,
  };
}

export default useWorkflowNavigation;
