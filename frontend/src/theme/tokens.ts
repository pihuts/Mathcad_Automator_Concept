/**
 * Design Token Utilities
 *
 * Re-export tokens for use in components.
 * Import from this file instead of hardcoding colors.
 *
 * @example
 * import { colors, getStatusColor } from '../theme/tokens';
 * <Box sx={{ color: colors.success.main }}>
 */

import { tokens } from './mui-theme';

// Color palette exports
export const colors = {
  primary: tokens.primary,
  accent: tokens.accent,
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
  info: tokens.info,
  neutral: tokens.neutral,
  surface: tokens.surface,
} as const;

// Alpha/opacity color tokens for overlays, glows, and effects
export const alpha = tokens.alpha;

// Spacing tokens
export const spacing = tokens.spacing;

// Border radius tokens
export const radius = tokens.radius;

// Shadow tokens
export const shadow = tokens.shadow;

// Transition tokens
export const transition = tokens.transition;

/**
 * Status color helper - returns appropriate color for status
 */
export function getStatusColor(status: 'success' | 'running' | 'failed' | 'pending' | 'skipped' | 'blocked' | 'completed'): string {
  const statusMap: Record<string, string> = {
    success: tokens.success.main,
    completed: tokens.success.main,
    running: tokens.primary[700],
    failed: tokens.error.main,
    error: tokens.error.main,
    pending: tokens.neutral[400],
    skipped: tokens.warning.main,
    blocked: tokens.neutral[500],
  };
  return statusMap[status] || tokens.neutral[500];
}

/**
 * Status background color helper - returns light background for status
 */
export function getStatusBgColor(status: 'success' | 'running' | 'failed' | 'pending' | 'skipped' | 'blocked' | 'completed'): string {
  const statusMap: Record<string, string> = {
    success: tokens.success.light,
    completed: tokens.success.light,
    running: tokens.primary[50],
    failed: tokens.error.light,
    error: tokens.error.light,
    pending: tokens.neutral[100],
    skipped: tokens.warning.light,
    blocked: tokens.neutral[200],
  };
  return statusMap[status] || tokens.neutral[100];
}

/**
 * Pill color variants for MuiPill component
 * Uses design tokens for consistent theming
 */
export const pillColors = {
  primary: {
    bg: tokens.primary[50],
    text: tokens.primary[700],
    border: tokens.primary[200],
    hoverBg: tokens.primary[100],
  },
  success: {
    bg: tokens.success.light,
    text: tokens.success.dark,
    border: tokens.success.border,
    hoverBg: tokens.success.hoverLight,
  },
  warning: {
    bg: tokens.warning.light,
    text: tokens.warning.dark,
    border: tokens.warning.border,
    hoverBg: tokens.warning.hoverLight,
  },
  error: {
    bg: tokens.error.light,
    text: tokens.error.dark,
    border: tokens.error.border,
    hoverBg: tokens.error.hoverLight,
  },
  info: {
    bg: tokens.info.light,
    text: tokens.info.dark,
    border: tokens.info.border,
    hoverBg: tokens.info.hoverLight,
  },
  // String inputs use teal accent palette (brand direction: jade-centered, restrained teal support)
  string: {
    bg: tokens.accent[50],
    text: tokens.accent[700],
    border: tokens.accent[200],
    hoverBg: tokens.accent[100],
  },
  default: {
    bg: tokens.neutral[100],
    text: tokens.neutral[600],
    border: tokens.neutral[200],
    hoverBg: tokens.neutral[200],
  },
} as const;

/**
 * Type for pill color variants
 */
export type PillColorVariant = keyof typeof pillColors;
