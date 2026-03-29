import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  Box,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import type { InputConfig } from '../services/api';
import { tokens } from '../theme/mui-theme';

interface LibraryModalProps {
  opened: boolean;
  onClose: () => void;
  filePath: string;
  currentInputs: Record<string, any[]>;
  currentUnits?: Record<string, string>;
  exportPdf: boolean;
  exportMcdx: boolean;
  outputDir?: string;
  onLoadConfig?: (config: { inputs: InputConfig[]; exportPdf: boolean; exportMcdx: boolean }) => void;
}

export const LibraryModal = ({
  opened,
  onClose,
  filePath,
  currentInputs,
  currentUnits = {},
  exportPdf,
  exportMcdx,
  outputDir,
  onLoadConfig,
}: LibraryModalProps) => {
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('load');
  const [saveName, setSaveName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    configs,
    isLoadingConfigs,
    listError,
    refetchConfigs,
    saveConfig,
    isSaving,
    saveError,
    loadConfig,
    isLoadingConfig,
    loadError,
  } = useLibrary(filePath);

  // Reset save state when modal opens
  useEffect(() => {
    if (opened) {
      setSaveName('');
      setSaveSuccess(false);
      refetchConfigs();
    }
  }, [opened, refetchConfigs]);

  const handleSave = () => {
    if (!saveName.trim()) return;

    const inputConfigs: InputConfig[] = Object.entries(currentInputs).flatMap(([alias, values]) => {
      if (!values || values.length === 0) return [];
      return [{ alias, value: values, units: currentUnits[alias] }];
    });

    const configRequest = {
      name: saveName,
      file_path: filePath,
      inputs: inputConfigs,
      export_pdf: exportPdf,
      export_mcdx: exportMcdx,
      output_dir: outputDir,
    };

    saveConfig(configRequest, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1500);
      },
    });
  };

  const handleLoad = (configPath: string) => {
    loadConfig(configPath, {
      onSuccess: (config) => {
        if (onLoadConfig) {
          onLoadConfig({
            inputs: config.inputs,
            exportPdf: config.export_pdf,
            exportMcdx: config.export_mcdx,
          });
          onClose();
        }
      },
    });
  };

  return (
    <Dialog
      open={opened}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Saved Configurations</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => v && setActiveTab(v as 'save' | 'load')}
            centered
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab value="load" label="Load Config" />
            <Tab value="save" label="Save Config" />
          </Tabs>

          {activeTab === 'load' && (
            <Box>
              {isLoadingConfigs && (
                <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />
              )}
              {listError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Error loading configs: {(listError as Error).message}
                </Alert>
              )}
              {!isLoadingConfigs && configs && configs.length === 0 && (
                <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                  No saved configurations found for this file.
                </Typography>
              )}
              {configs && configs.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: tokens.neutral[50] }}>
                        <TableCell>Name</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {configs.map((config) => (
                        <TableRow key={config.path} hover>
                          <TableCell>{config.name}</TableCell>
                          <TableCell>{new Date(config.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleLoad(config.path)}
                              disabled={isLoadingConfig}
                            >
                              Load
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {loadError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Error loading config: {(loadError as Error).message}
                </Alert>
              )}
            </Box>
          )}

          {activeTab === 'save' && (
            <Stack spacing={2}>
              <TextField
                label="Configuration Name"
                placeholder="e.g., Bolt Diameters, Load Case 1"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                fullWidth
                size="small"
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  startIcon={<SaveIcon />}
                  variant="contained"
                >
                  Save Configuration
                </Button>
                {saveSuccess && (
                  <Chip label="Saved successfully!" color="success" size="small" />
                )}
              </Stack>
              {saveError && (
                <Alert severity="error">
                  Error saving config: {(saveError as Error).message}
                </Alert>
              )}
              <Typography variant="caption" color="text.secondary">
                This will save the current input configuration to a library template for reuse.
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
};
