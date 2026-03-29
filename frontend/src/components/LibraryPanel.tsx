import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  Tabs,
  Tab,
  Stack,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { useWorkflowLibrary } from '../hooks/useWorkflowLibrary';
import type { WorkflowConfig } from '../services/api';

interface LibraryPanelProps {
  onBack: () => void;
  currentWorkflow: WorkflowConfig;
  onLoadWorkflow: (config: WorkflowConfig) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  onBack,
  currentWorkflow,
  onLoadWorkflow,
}) => {
  const [activeTab, setActiveTab] = useState(0);
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
  } = useWorkflowLibrary();

  useEffect(() => {
    refetchConfigs();
  }, [refetchConfigs]);

  const handleSave = () => {
    if (!saveName.trim()) return;

    const configRequest = {
      ...currentWorkflow,
      name: saveName,
    };

    saveConfig(configRequest, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setActiveTab(0); // Switch to load tab
        }, 1500);
      },
    });
  };

  const handleLoad = (configPath: string) => {
    loadConfig(configPath, {
      onSuccess: (config) => {
        onLoadWorkflow(config);
      },
    });
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

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, fontFamily: 'Lexend' }}>
        Workflow Library
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="fullWidth"
        sx={{ 
          mb: 2, 
          minHeight: 40,
          '& .MuiTab-root': {
            textTransform: 'none',
            minHeight: 40,
            fontWeight: 500,
            fontSize: '0.875rem',
          }
        }}
      >
        <Tab label="Load" />
        <Tab label="Save" />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 0 && (
          <Stack spacing={2}>
            {isLoadingConfigs && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {listError && (
              <Alert severity="error">Error loading workflows: {(listError as Error).message}</Alert>
            )}
            {!isLoadingConfigs && configs && configs.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No saved workflows found.
              </Typography>
            )}
            {configs && configs.length > 0 && (
              <List disablePadding>
                {configs.map((config, index) => (
                  <React.Fragment key={config.path}>
                    <ListItem disableGutters sx={{ py: 1.5 }}>
                      <ListItemText
                        primary={config.name}
                        secondary={`${config.files_count} files • ${new Date(config.created_at).toLocaleDateString()}`}
                        primaryTypographyProps={{ 
                          fontWeight: 500,
                          variant: 'body2',
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption'
                        }}
                      />
                      <ListItemSecondaryAction sx={{ right: 0 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleLoad(config.path)}
                          disabled={isLoadingConfig}
                          startIcon={isLoadingConfig ? <CircularProgress size={14} color="inherit" /> : null}
                          sx={{
                            borderRadius: 20,
                            textTransform: 'none',
                            fontSize: '0.875rem',
                            py: 0.5
                          }}
                        >
                          {isLoadingConfig ? 'Loading...' : 'Load'}
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < configs.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
            {loadError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Error loading workflow: {(loadError as Error).message}
              </Alert>
            )}
          </Stack>
        )}

        {activeTab === 1 && (
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Workflow Name"
              placeholder="e.g., Steel Beam Design"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Box>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSave}
                disabled={isSaving || !saveName.trim()}
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                sx={{ 
                  borderRadius: 20, 
                  textTransform: 'none', 
                  py: 1,
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: 'none',
                  }
                }}
              >
                {isSaving ? 'Saving...' : (saveSuccess ? 'Saved Successfully!' : 'Save Current Workflow')}
              </Button>
            </Box>
            {saveError && (
              <Alert severity="error">Error saving workflow: {(saveError as Error).message}</Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              This saves all files, mappings, and export settings to the library.
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

