/**
 * Shared workflow utility functions
 */

const STRING_INDICATORS = ['string', 'text', 'name', 'label', 'path', 'file', 'dir', 'url'] as const;

/**
 * Detect whether an input is numeric or string based on its name.
 * Used to determine pill styling and input handling behavior.
 */
export const detectInputType = (inputName: string): 'number' | 'string' => {
  const lowerName = inputName.toLowerCase();
  return STRING_INDICATORS.some((s) => lowerName.includes(s)) ? 'string' : 'number';
};
