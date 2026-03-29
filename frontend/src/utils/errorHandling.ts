/**
 * Error Handling and Edge Case Utilities
 *
 * Centralized utilities for handling common edge cases, errors,
 * and defensive programming patterns across the application.
 */

/**
 * Safe number formatting that handles edge cases
 */
export function formatNumber(
  value: unknown,
  options?: {
    decimals?: number;
    fallback?: string;
    maxDigits?: number;
  }
): string {
  const { decimals = 4, fallback = '—', maxDigits = 15 } = options || {};

  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'number' || !isFinite(value)) return fallback;

  // Handle very large numbers
  if (Math.abs(value) > Math.pow(10, maxDigits)) {
    return value.toExponential(2);
  }

  // Handle very small numbers
  if (Math.abs(value) < Math.pow(10, -decimals) && value !== 0) {
    return value.toExponential(2);
  }

  return value.toFixed(decimals);
}

/**
 * Truncate text with ellipsis, handling edge cases
 */
export function truncateText(
  text: unknown,
  maxLength: number = 50,
  options?: {
    ellipsis?: string;
    wordBoundary?: boolean;
  }
): string {
  const { ellipsis = '...', wordBoundary = false } = options || {};

  if (text === null || text === undefined) return '';
  const str = String(text);

  if (str.length <= maxLength) return str;

  if (wordBoundary) {
    const truncated = str.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + ellipsis;
    }
  }

  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Truncate file path to show the end (most relevant part)
 */
export function truncateFilePath(
  path: unknown,
  maxLength: number = 40
): string {
  if (path === null || path === undefined) return '';
  const str = String(path);

  if (str.length <= maxLength) return str;

  // Try to show filename and some directory context
  const parts = str.split(/[/\\]/);
  const fileName = parts[parts.length - 1];

  if (fileName.length >= maxLength - 3) {
    return '...' + fileName.substring(fileName.length - maxLength + 6);
  }

  // Show start of path and filename
  const remaining = maxLength - fileName.length - 4;
  if (remaining > 0) {
    const start = str.substring(0, remaining);
    return `${start}.../${fileName}`;
  }

  return '...' + fileName;
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = 'An unexpected error occurred'
): string {
  if (error === null || error === undefined) return fallback;

  if (typeof error === 'string') {
    return error || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object') {
    // Handle API error responses
    const apiError = error as { message?: string; error?: string; detail?: string };
    return apiError.message || apiError.error || apiError.detail || fallback;
  }

  return fallback;
}

/**
 * Debounce function for input handling
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Validate numeric input
 */
export function validateNumericInput(
  value: string,
  options?: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    allowDecimal?: boolean;
  }
): { valid: boolean; value?: number; error?: string } {
  const { min, max, allowNegative = true, allowDecimal = true } = options || {};

  if (!value || value.trim() === '') {
    return { valid: false, error: 'Value is required' };
  }

  const num = allowDecimal ? parseFloat(value) : parseInt(value, 10);

  if (isNaN(num)) {
    return { valid: false, error: 'Must be a valid number' };
  }

  if (!allowNegative && num < 0) {
    return { valid: false, error: 'Value cannot be negative' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Minimum value is ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Maximum value is ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Parse range input (e.g., "1..10..0.5")
 */
export function parseRangeInput(
  input: string
): { valid: boolean; values?: number[]; error?: string } {
  const match = input.trim().match(/^(-?\d+\.?\d*)\.\.(-?\d+\.?\d*)\.\.(-?\d+\.?\d*)$/);

  if (!match) {
    return { valid: false, error: 'Invalid range format. Use: start..end..step' };
  }

  const start = parseFloat(match[1]);
  const end = parseFloat(match[2]);
  const step = parseFloat(match[3]);

  if (step <= 0) {
    return { valid: false, error: 'Step must be greater than 0' };
  }

  if (start === end) {
    return { valid: true, values: [start] };
  }

  const values: number[] = [];
  const direction = start < end ? 1 : -1;
  const maxIterations = 10000; // Safety limit

  let current = start;
  let iterations = 0;

  while ((direction > 0 ? current <= end : current >= end) && iterations < maxIterations) {
    values.push(Math.round(current * 10000) / 10000);
    current += step * direction;
    iterations++;
  }

  if (iterations >= maxIterations) {
    return { valid: false, error: 'Range would generate too many values' };
  }

  return { valid: true, values };
}

/**
 * Check if we're offline
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Generate unique ID for accessibility and keys
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
