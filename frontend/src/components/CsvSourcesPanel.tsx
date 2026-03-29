import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { IconCsv, IconTrash, IconUpload } from '@tabler/icons-react';
import { tokens } from '../theme/mui-theme';
import type { CsvFile } from '../hooks/useCsvSources';

// MAX_FILES = 8 (CONTEXT.md: 5-10 range; 8 chosen as balance between flexibility and UI clutter)
const MAX_FILES = 8;

export interface CsvSourcesPanelProps {
  files: CsvFile[];
  onBack: () => void;
  onUpload: (files: FileList) => Promise<void>;
  onRemove: (id: string) => { affected: CsvFile['referencedBy'] } | null;
}

export function CsvSourcesPanel({ files, onBack, onUpload, onRemove }: CsvSourcesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleRemove = (file: CsvFile) => {
    if (file.referencedBy.length > 0) {
      const affected = file.referencedBy
        .map(r => `Step ${r.stepPosition + 1}: ${r.inputAlias}`)
        .join(', ');
      if (!window.confirm(`This CSV is used by: ${affected}. Remove anyway?`)) {
        return;
      }
    }
    onRemove(file.id);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.target.files);
      } finally {
        setIsUploading(false);
        // Reset input for re-upload of same file
        e.target.value = '';
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
          onClick={onBack}
          sx={{
            color: 'primary.main',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
            p: 0,
            minWidth: 0,
          }}
        >
          Back
        </Button>
      </Box>

      {/* Header */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Lexend' }}>
        CSV Data Sources
      </Typography>

      {/* File List */}
      <Stack spacing={1} sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {files.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: tokens.neutral[50], border: `2px dashed ${tokens.neutral[200]}` }}>
            <IconCsv size={48} color={tokens.neutral[400]} aria-hidden="true" />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              No CSV files uploaded
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Upload CSV files to reference columns in workflow inputs
            </Typography>
          </Paper>
        ) : (
          files.map(file => (
            <Paper
              key={file.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: `1px solid ${tokens.neutral[200]}`,
                '&:hover': { borderColor: tokens.neutral[300] },
              }}
            >
              <IconCsv size={24} color={tokens.warning.main} aria-hidden="true" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {file.name}
                </Typography>
                <Tooltip title={file.columns.join(', ')} placement="bottom-start">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help' }}>
                    {file.columns.length} column{file.columns.length !== 1 ? 's' : ''}
                    {file.referencedBy.length > 0 && (
                      <> &bull; Used by {file.referencedBy.length} input{file.referencedBy.length !== 1 ? 's' : ''}</>
                    )}
                  </Typography>
                </Tooltip>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleRemove(file)}
                sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.lighter' } }}
              >
                <IconTrash size={18} />
              </IconButton>
            </Paper>
          ))
        )}
      </Stack>

      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        hidden
        onChange={handleFileChange}
        aria-label="Upload CSV files"
      />
      <Button
        variant="contained"
        startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <IconUpload size={18} />}
        onClick={() => fileInputRef.current?.click()}
        disabled={files.length >= MAX_FILES || isUploading}
        fullWidth
      >
        {isUploading ? 'Uploading...' : `Upload CSV ${files.length > 0 ? `(${files.length}/${MAX_FILES})` : ''}`}
      </Button>
    </Box>
  );
}
