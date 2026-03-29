/**
 * Generates an array of numbers from start to end with a given step.
 * Includes safety limits to prevent memory issues with large ranges.
 */
export const generateRange = (start: number, end: number, step: number): number[] => {
  // Safety limit to prevent generating too many values
  const MAX_VALUES = 10000;

  // Edge case: invalid inputs
  if (!isFinite(start) || !isFinite(end) || !isFinite(step)) {
    return [];
  }

  // Edge case: zero or negative step when going forward
  if (start < end && step <= 0) {
    return [start];
  }

  // Edge case: zero or positive step when going backward
  if (start > end && step >= 0) {
    return [start];
  }

  // Edge case: start equals end
  if (start === end) {
    return [start];
  }

  // Edge case: zero step
  if (step === 0) {
    return [start];
  }

  // Calculate expected number of iterations
  const expectedIterations = Math.ceil(Math.abs(end - start) / Math.abs(step));

  // Safety check: too many values
  if (expectedIterations > MAX_VALUES) {
    console.warn(`Range would generate ${expectedIterations} values, limiting to ${MAX_VALUES}`);
    // Return a sampled range instead
    const sampledStep = (end - start) / MAX_VALUES;
    const results: number[] = [];
    for (let i = start; step > 0 ? i <= end : i >= end; i += sampledStep) {
      results.push(Number(i.toFixed(10)));
      if (results.length >= MAX_VALUES) break;
    }
    return results;
  }

  const results: number[] = [];

  if (step > 0) {
    for (let i = start; i <= end + 0.0000001; i += step) { // Small epsilon for floating point
      // Handle floating point precision issues
      results.push(Number(i.toFixed(10)));
      if (results.length >= MAX_VALUES) break;
    }
  } else {
    for (let i = start; i >= end - 0.0000001; i += step) {
      results.push(Number(i.toFixed(10)));
      if (results.length >= MAX_VALUES) break;
    }
  }

  return results;
};

/**
 * Generates Cartesian product of all inputs.
 * inputsMap: { [alias]: Array of values }
 * Returns: Array of objects { [alias]: value }
 */
export const generateCartesian = (inputsMap: Record<string, any[]>): Record<string, any>[] => {
  const keys = Object.keys(inputsMap);
  if (keys.length === 0) return [];

  const results: Record<string, any>[] = [{}];

  for (const key of keys) {
    const values = inputsMap[key];
    const nextResults: Record<string, any>[] = [];

    for (const result of results) {
      for (const value of values) {
        nextResults.push({ ...result, [key]: value });
      }
    }
    results.splice(0, results.length, ...nextResults);
  }

  return results;
};

/**
 * Zips inputs together row-by-row.
 * inputsMap: { [alias]: Array of values }
 * Returns: Array of objects { [alias]: value }
 */
export const generateZip = (inputsMap: Record<string, any[]>): Record<string, any>[] => {
  const keys = Object.keys(inputsMap);
  if (keys.length === 0) return [];

  const minLength = Math.min(...keys.map(key => inputsMap[key].length));
  const results: Record<string, any>[] = [];

  for (let i = 0; i < minLength; i++) {
    const row: Record<string, any> = {};
    for (const key of keys) {
      row[key] = inputsMap[key][i];
    }
    results.push(row);
  }

  return results;
};

/**
 * Extracts the filename from a full file path.
 * Handles both Windows (backslash) and Unix (forward slash) paths.
 * @param path - Full file path
 * @returns Filename portion of the path
 */
export const extractFilename = (path: string): string => {
  if (!path) return '';
  // Handle both Windows and Unix path separators
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || '';
};

/**
 * Truncates text to a maximum length with ellipsis.
 * Adds ellipsis (...) if text exceeds maxLength.
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Formats a number with appropriate precision and removes trailing zeros.
 * @param value - Number to format
 * @param maxDecimals - Maximum decimal places
 * @returns Formatted number string
 */
export const formatNumber = (value: number, maxDecimals: number = 4): string => {
  if (typeof value !== 'number' || isNaN(value)) return '-';
  return Number(value.toFixed(maxDecimals)).toString();
};
