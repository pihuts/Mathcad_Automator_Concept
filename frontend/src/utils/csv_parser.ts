import Papa from 'papaparse';

export interface CSVParseResult {
  data: any[];
  meta: Papa.ParseMeta;
  errors: Papa.ParseError[];
}

/**
 * Parses a CSV file and returns the data as an array of objects.
 * Uses the first row as headers.
 */
export const parseCSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

/**
 * Reads the CSV file and returns the list of headers (first row).
 */
export const getHeaders = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      preview: 1, // Only parse the first line
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          resolve(results.data[0] as string[]);
        } else {
          resolve([]);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

/**
 * Export data array to CSV file download.
 * Handles special characters, quotes, and Excel-compatible UTF-8 encoding.
 *
 * @param data - Array of objects to export
 * @param filename - Output filename (default: 'export.csv')
 * @param options - Optional PapaParse unparse options
 */
export const exportToCsv = (
  data: any[],
  filename: string = 'export.csv',
  options?: Papa.UnparseConfig
): void => {
  const csv = Papa.unparse(data, {
    quotes: true,
    header: true,
    ...options,
  });

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
