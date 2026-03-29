/**
 * Batch Iteration Utilities
 *
 * Provides utilities for generating and validating batch iterations
 * for both Combination (all permutations) and Zip (paired by row) modes.
 *
 * Includes case transformation for string values to uppercase/lowercase (per-input).
 */

export type CaseTransform = 'none' | 'uppercase' | 'lowercase'

export interface MultiValueInput {
  alias: string;
  values: any[]; // Empty array or single-element for constants
  caseTransform?: CaseTransform; // Per-input case transformation
}

export type BatchMode = 'combination' | 'zip';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that multi-value inputs have equal lengths for Zip mode.
 * Constants (empty or single-element arrays) are ignored.
 *
 * @param inputs - Array of MultiValueInput objects
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateZipMode(inputs: MultiValueInput[]): ValidationResult {
  // Filter to multi-value inputs (more than 1 value)
  const multiValueInputs = inputs.filter(input => input.values.length > 1);

  // No multi-value inputs means all constants - valid
  if (multiValueInputs.length === 0) {
    return { valid: true };
  }

  // Check all multi-value inputs have the same length
  const firstLength = multiValueInputs[0].values.length;
  const mismatched = multiValueInputs.filter(input => input.values.length !== firstLength);

  if (mismatched.length > 0) {
    const details = multiValueInputs.map(input =>
      `${input.alias}: ${input.values.length} values`
    ).join(', ');

    return {
      valid: false,
      error: `Zip mode requires all multi-value inputs to have the same number of values. Found: ${details}`
    };
  }

  return { valid: true };
}

/**
 * Applies case transformation to a value if it's a string
 */
function applyCaseTransform(value: any, caseTransform: CaseTransform): any {
  if (typeof value === 'string') {
    if (caseTransform === 'uppercase') {
      return value.toUpperCase()
    } else if (caseTransform === 'lowercase') {
      return value.toLowerCase()
    }
  }
  return value
}

/**
 * Transforms values in an input array based on its caseTransform setting
 */
function transformInputValues(input: MultiValueInput): any[] {
  const caseTransform = input.caseTransform || 'none'
  console.log(`[transformInputValues] ${input.alias}: caseTransform=${caseTransform}, input values:`, input.values.slice(0, 5));
  if (caseTransform === 'none') {
    console.log(`[transformInputValues] ${input.alias}: No transform, returning ${input.values.length} values`);
    return input.values
  }
  const transformed = input.values.map(v => applyCaseTransform(v, caseTransform))
  const uniqueBefore = new Set(input.values).size
  const uniqueAfter = new Set(transformed).size
  console.log(`[transformInputValues] ${input.alias}: Transformed ${input.values.length} values, unique before=${uniqueBefore}, unique after=${uniqueAfter}`);
  console.log(`[transformInputValues] ${input.alias}: First 5 transformed:`, transformed.slice(0, 5));
  return transformed
}

/**
 * Transforms all inputs by applying their individual caseTransform settings
 */
function transformAllInputs(inputs: MultiValueInput[]): MultiValueInput[] {
  return inputs.map(input => ({
    ...input,
    values: transformInputValues(input)
  }))
}

/**
 * Calculates the total number of iterations for a batch.
 *
 * Combination mode: product of unique values.length (after deduplication per input)
 * Zip mode: unique row count after deduplication (or 1 if all constants)
 *
 * @param inputs - Array of MultiValueInput objects (each may have its own caseTransform)
 * @param mode - 'combination' or 'zip'
 * @param caseTransform - DEPRECATED: Optional global fallback for backwards compatibility
 * @returns Number of iterations
 */
export function calculateIterationCount(
  inputs: MultiValueInput[],
  mode: BatchMode,
  caseTransform?: CaseTransform
): number {
  // Filter to inputs with at least one value
  const inputsWithValues = inputs.filter(input => input.values.length > 0)

  // No inputs means 1 execution (no inputs to vary)
  if (inputsWithValues.length === 0) {
    return 1
  }

  // Transform values using per-input caseTransform (with optional global fallback)
  const transformedInputs = transformAllInputs(inputsWithValues.map(input => ({
    ...input,
    caseTransform: input.caseTransform || caseTransform || 'none'
  })))

  // Filter to multi-value inputs
  const multiValueInputs = transformedInputs.filter(input => input.values.length > 1)

  // All single values means 1 execution
  if (multiValueInputs.length === 0) {
    return 1
  }

  if (mode === 'zip') {
    // Zip mode: count unique rows after deduplication
    const iterations = generateZipIterations(transformedInputs)
    return iterations.length
  } else {
    // Combination mode: product of unique value counts (deduplicated per input)
    return multiValueInputs.reduce((product, input) => product * new Set(input.values).size, 1)
  }
}

/**
 * Generates iteration objects for batch execution.
 *
 * Combination mode: cartesian product of all values
 * Zip mode: pair values by index
 *
 * @param inputs - Array of MultiValueInput objects (each may have its own caseTransform)
 * @param mode - 'combination' or 'zip'
 * @param caseTransform - DEPRECATED: Optional global fallback for backwards compatibility
 * @returns Array of { [alias]: value } objects
 */
export function generateIterations(
  inputs: MultiValueInput[],
  mode: BatchMode,
  caseTransform?: CaseTransform
): Record<string, any>[] {
  console.log('[generateIterations] Called with mode:', mode, 'inputs:', inputs.map(i => ({ alias: i.alias, valueCount: i.values.length, firstValues: i.values.slice(0, 3) })));

  // Filter to inputs with at least one value
  const inputsWithValues = inputs.filter(input => input.values.length > 0)

  // No inputs means single empty iteration
  if (inputsWithValues.length === 0) {
    return [{}]
  }

  // Transform values using per-input caseTransform (with optional global fallback)
  const transformedInputs = transformAllInputs(inputsWithValues.map(input => ({
    ...input,
    caseTransform: input.caseTransform || caseTransform || 'none'
  })))

  console.log('[generateIterations] After transform:', transformedInputs.map(i => ({ alias: i.alias, valueCount: i.values.length, firstValues: i.values.slice(0, 3) })));

  if (mode === 'zip') {
    return generateZipIterations(transformedInputs)
  } else {
    return generateCombinationIterations(transformedInputs)
  }
}

/**
 * Generates zip iterations (paired by index).
 * Deduplicates rows where all input values are identical, keeping first occurrence.
 * Zip mode is for row-by-row processing where each input row maps to one output.
 */
function generateZipIterations(inputs: MultiValueInput[]): Record<string, any>[] {
  // Validate first - if invalid, return empty
  const validation = validateZipMode(inputs);
  if (!validation.valid) {
    return [];
  }

  // Find the iteration count (length of first multi-value input, or 1 if all constants)
  const multiValueInputs = inputs.filter(input => input.values.length > 1);
  const count = multiValueInputs.length > 0
    ? multiValueInputs[0].values.length
    : 1;

  // Debug logging - show actual values with unique counts
  console.log('[generateZipIterations] Input values:');
  inputs.forEach(i => {
    const uniqueCount = new Set(i.values).size;
    console.log(`  ${i.alias}: ${i.values.length} total, ${uniqueCount} unique, first 5:`, i.values.slice(0, 5));
  });
  console.log('[generateZipIterations] Generating up to', count, 'iterations (with deduplication)');

  const iterations: Record<string, any>[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < count; i++) {
    const iteration: Record<string, any> = {};

    for (const input of inputs) {
      // For constants (length 0 or 1), use the single value or undefined
      // For multi-value, use the value at current index
      if (input.values.length === 0) {
        iteration[input.alias] = undefined;
      } else if (input.values.length === 1) {
        iteration[input.alias] = input.values[0];
      } else {
        iteration[input.alias] = input.values[i];
      }
    }

    // Create a key for deduplication - serialize all values in consistent order
    const key = JSON.stringify(inputs.map(inp => {
      if (inp.values.length === 0) return undefined;
      if (inp.values.length === 1) return inp.values[0];
      return inp.values[i];
    }));

    // Only add if we haven't seen this combination before
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      iterations.push(iteration);
    }
  }

  // Show first 5 iterations to verify values are correct
  console.log('[generateZipIterations] First 5 iterations (after deduplication):');
  iterations.slice(0, 5).forEach((iter, idx) => {
    console.log(`  Iteration ${idx + 1}:`, JSON.stringify(iter));
  });
  console.log(`[generateZipIterations] Deduplicated ${count} rows to ${iterations.length} unique combinations`);

  return iterations;
}

/**
 * Generates combination iterations (cartesian product of unique values).
 * Values are deduplicated per input before creating combinations.
 */
function generateCombinationIterations(inputs: MultiValueInput[]): Record<string, any>[] {
  // Start with a single empty iteration
  let iterations: Record<string, any>[] = [{}];

  for (const input of inputs) {
    const newIterations: Record<string, any>[] = [];

    // Deduplicate values for this input
    const uniqueValues = [...new Set(input.values)];

    for (const iteration of iterations) {
      if (uniqueValues.length === 0) {
        // No values - add undefined
        newIterations.push({
          ...iteration,
          [input.alias]: undefined
        });
      } else {
        // Add each unique value
        for (const value of uniqueValues) {
          newIterations.push({
            ...iteration,
            [input.alias]: value
          });
        }
      }
    }

    iterations = newIterations;
  }

  return iterations;
}
