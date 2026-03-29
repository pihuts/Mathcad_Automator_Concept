// frontend/src/utils/fileUtils.ts
/**
 * Shared file path utilities.
 * Consolidates duplicated path handling across components.
 */

/**
 * Extract display name from file path.
 * Handles both Windows (\) and Unix (/) path separators.
 *
 * @param filePath - Full file path or undefined
 * @returns File name without directory, or 'No file selected' if undefined
 */
export const getDisplayName = (filePath?: string): string => {
  if (!filePath) return 'No file selected';
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
};

/**
 * Get file extension from path.
 *
 * @param filePath - Full file path
 * @returns File extension without dot, or empty string if none
 */
export const getFileExtension = (filePath: string): string => {
  const fileName = getDisplayName(filePath);
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
};

/**
 * Check if file is a Mathcad file.
 *
 * @param filePath - File path to check
 * @returns True if file has .mcdx extension
 */
export const isMathcadFile = (filePath: string): boolean => {
  return getFileExtension(filePath) === 'mcdx';
};
