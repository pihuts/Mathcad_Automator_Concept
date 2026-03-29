import { useState, useCallback } from 'react';
import { parseCSV } from '../utils/csv_parser';

export interface CsvFile {
  id: string;           // Unique identifier (filename-timestamp)
  name: string;         // Display filename
  columns: string[];    // Column headers
  previewData: any[];   // First 100 rows for preview
  referencedBy: Array<{ stepPosition: number; inputAlias: string; column: string }>;
}

export interface UseCsvSourcesReturn {
  files: CsvFile[];
  addFiles: (fileList: FileList) => Promise<void>;
  removeFile: (id: string) => { affected: CsvFile['referencedBy'] } | null;
  getColumnsGrouped: () => Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  addReference: (fileId: string, column: string, stepPosition: number, inputAlias: string) => void;
  removeReference: (stepPosition: number, inputAlias: string) => void;
  getColumnValues: (fileId: string, column: string) => any[];
  clearAll: () => void;
}

const MAX_FILES = 8;

export function useCsvSources(): UseCsvSourcesReturn {
  const [files, setFiles] = useState<CsvFile[]>([]);

  const addFiles = async (fileList: FileList) => {
    const newFiles: CsvFile[] = [];
    for (const file of Array.from(fileList)) {
      if (files.length + newFiles.length >= MAX_FILES) break;

      try {
        // Step 1: Parse CSV using parseCSV from csv_parser.ts (returns array of row objects)
        const parsedData = await parseCSV(file);

        // Step 2: Extract column headers - use Object.keys on first row
        // (parseCSV uses header:true, so first row keys are the headers)
        const columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];

        // Step 3: Store first 100 rows as previewData for preview values
        const previewData = parsedData.slice(0, 100);

        newFiles.push({
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          columns,
          previewData,
          referencedBy: [],
        });
      } catch (error) {
        console.error(`Failed to parse CSV file ${file.name}:`, error);
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (!fileToRemove) return null;

    const affected = [...fileToRemove.referencedBy];
    setFiles(prev => prev.filter(f => f.id !== id));
    return { affected };
  };

  const getColumnsGrouped = () => {
    return files.map(file => ({
      group: file.name,
      columns: file.columns.map(col => ({
        value: `${file.id}|${col}`,  // Format: "fileId|columnName" for later parsing
        label: col,
        // Extract first 2-3 values from previewData for this column
        preview: file.previewData.slice(0, 3).map(row => String(row[col] ?? '')),
      })),
    }));
  };

  const addReference = (fileId: string, column: string, stepPosition: number, inputAlias: string) => {
    setFiles(prev => prev.map(file => {
      if (file.id === fileId) {
        // Avoid duplicates
        const exists = file.referencedBy.some(ref => 
          ref.stepPosition === stepPosition && 
          ref.inputAlias === inputAlias && 
          ref.column === column
        );
        if (exists) return file;
        
        return {
          ...file,
          referencedBy: [...file.referencedBy, { stepPosition, inputAlias, column }]
        };
      }
      return file;
    }));
  };

  const removeReference = (stepPosition: number, inputAlias: string) => {
    setFiles(prev => prev.map(file => ({
      ...file,
      referencedBy: file.referencedBy.filter(ref => !(ref.stepPosition === stepPosition && ref.inputAlias === inputAlias))
    })));
  };

  const getColumnValues = (fileId: string, column: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return [];
    return file.previewData.map(row => row[column]);
  };

  const clearAll = useCallback(() => {
    setFiles([]);
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    getColumnsGrouped,
    addReference,
    removeReference,
    getColumnValues,
    clearAll
  };
}
