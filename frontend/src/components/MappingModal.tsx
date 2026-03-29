import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  IconButton,
  Alert,
  AlertTitle,
  Paper,
  Box,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { UNIT_PRESETS } from '../constants/units';
import type { FileMapping, WorkflowFile, MetaData } from '../services/api';

interface MappingModalProps {
  opened: boolean;
  onClose: () => void;
  targetFile: WorkflowFile;
  allFiles: WorkflowFile[];
  filesMetadata: Record<string, MetaData>;
  currentMappings: FileMapping[];
  onSave: (mappings: FileMapping[]) => void;
}

export const MappingModal = ({
  opened,
  onClose,
  targetFile,
  allFiles,
  filesMetadata,
  currentMappings,
  onSave,
}: MappingModalProps) => {
  const [mappings, setMappings] = useState<FileMapping[]>(currentMappings);

  const upstreamFiles = useMemo(() => {
    const targetIndex = allFiles.findIndex((f) => f.file_path === targetFile.file_path);
    return targetIndex > 0 ? allFiles.slice(0, targetIndex) : [];
  }, [allFiles, targetFile.file_path]);

  const addMapping = () => {
    if (!targetFile.file_path) {
      console.warn('Cannot add mapping: target file has no path');
      return;
    }

    const newMapping: FileMapping = {
      source_file: '',
      source_alias: '',
      target_file: targetFile.file_path,
      target_alias: '',
      units: '',
    };
    setMappings([...mappings, newMapping]);
  };

  const removeMapping = (index: number) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings);
  };

  const updateMapping = (index: number, field: keyof FileMapping, value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleSave = () => {
    const validMappings = mappings.filter(
      (m) => m.source_file && m.source_alias && m.target_alias
    );
    onSave(validMappings);
    onClose();
  };

  const sourceOptions = useMemo(() => upstreamFiles.map((f) => ({
    group: f.file_path || `File ${f.position}`,
    items: (filesMetadata[f.file_path]?.outputs || []).map((o) => ({
      value: `${f.file_path}|${o.alias}`,
      label: `${o.alias}`,
    })),
  })), [upstreamFiles, filesMetadata]);

  const targetInputOptions = useMemo(() =>
    (filesMetadata[targetFile.file_path]?.inputs || []).map((i) => ({
      value: i.alias,
      label: i.alias,
    })), [filesMetadata, targetFile.file_path]);

  const targetAliasesUsed = mappings.map((m) => m.target_alias);
  const hasDuplicates = new Set(targetAliasesUsed).size !== targetAliasesUsed.length;

  return (
    <Dialog
      open={opened}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Configure Mapping</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap color="text.secondary">
            FILE: {targetFile.file_path || 'UNDEFINED'}
          </Typography>

          {upstreamFiles.length === 0 && (
            <Alert severity="warning">
              <AlertTitle>No Upstream Files</AlertTitle>
              Add files before this one in the workflow sequence to create data links.
            </Alert>
          )}

          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            <Stack spacing={1}>
              {mappings.map((mapping, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 2, backgroundColor: 'background.paper' }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Source Output</InputLabel>
                        <Select
                          value={mapping.source_file && mapping.source_alias ? `${mapping.source_file}|${mapping.source_alias}` : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              const [source_file, source_alias] = value.split('|');
                              updateMapping(idx, 'source_file', source_file);
                              updateMapping(idx, 'source_alias', source_alias);
                            }
                          }}
                          label="Source Output"
                          disabled={upstreamFiles.length === 0}
                        >
                          {sourceOptions.map((group) => [
                            <MenuItem disabled key={group.group} sx={{ fontWeight: 'bold', opacity: 0.7 }}>
                              {group.group}
                            </MenuItem>,
                            ...group.items.map((item) => (
                              <MenuItem key={item.value} value={item.value} sx={{ pl: 4 }}>
                                {item.label}
                              </MenuItem>
                            ))
                          ])}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth size="small">
                        <InputLabel>Target Input</InputLabel>
                        <Select
                          value={mapping.target_alias}
                          onChange={(e) => updateMapping(idx, 'target_alias', e.target.value)}
                          label="Target Input"
                          disabled={!targetFile.file_path}
                        >
                          {targetInputOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth size="small">
                        <InputLabel>Expected Units</InputLabel>
                        <Select
                          value={mapping.units || ''}
                          onChange={(e) => updateMapping(idx, 'units', e.target.value)}
                          label="Expected Units"
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {UNIT_PRESETS.map((unit) => (
                            <MenuItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>

                    <IconButton
                      color="error"
                      onClick={() => removeMapping(idx)}
                      aria-label="Remove mapping"
                      size="small"
                      sx={{ mt: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addMapping}
              disabled={upstreamFiles.length === 0}
              size="small"
            >
              Add Mapping
            </Button>
          </Stack>

          {hasDuplicates && (
            <Alert severity="error">
              <AlertTitle>Conflict Detected</AlertTitle>
              Duplicate target inputs detected. Each input can only be mapped once.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={hasDuplicates}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
