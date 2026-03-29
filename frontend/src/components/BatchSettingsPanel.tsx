import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Select,
  type SelectChangeEvent,
  MenuItem,
  FormControl,
  Divider,
} from '@mui/material';
import { IconX, IconFolder } from '@tabler/icons-react';
import { useSettings, type OutputDirMode } from '../hooks/useSettings';
import { browseFolder, validateOutputDir } from '../services/api';
import { tokens } from '../theme/mui-theme';

export interface BatchSettingsPanelProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Optional source file path for output dir resolution */
  sourceFilePath?: string;
}

/**
 * Settings drawer for the batch processing view.
 * Provides access to output directory configuration.
 */
export function BatchSettingsPanel({
  open,
  onClose,
  sourceFilePath,
}: BatchSettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const [customPathError, setCustomPathError] = React.useState<string | null>(null);

  const handleOutputDirModeChange = async (event: SelectChangeEvent) => {
    const newMode = event.target.value as OutputDirMode;
    if (newMode === 'custom') {
      const result = await browseFolder();
      if (!result.cancelled && result.path) {
        const validation = await validateOutputDir({
          mode: 'custom',
          custom_path: result.path,
          source_file_path: sourceFilePath,
        });
        if (validation.valid) {
          updateSettings({ outputDirMode: 'custom', customOutputDir: result.path });
          setCustomPathError(null);
        } else {
          setCustomPathError(validation.error || 'Invalid path');
        }
      }
    } else {
      updateSettings({ outputDirMode: newMode, customOutputDir: null });
      setCustomPathError(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-settings-title"
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 360 },
          backgroundColor: tokens.surface.paper,
          borderLeft: `1px solid ${tokens.neutral[100]}`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: `1px solid ${tokens.neutral[100]}`,
        }}
      >
        <Typography
          id="batch-settings-title"
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: tokens.primary[700],
            letterSpacing: '0.02em',
          }}
        >
          Batch Settings
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close batch settings"
          sx={{
            color: tokens.neutral[500],
            '&:hover': { color: tokens.neutral[700] },
          }}
        >
          <IconX size={18} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={3}>
          {/* Output Directory Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <IconFolder size={18} color={tokens.accent[700]} />
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.neutral[700],
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Output Directory
              </Typography>
            </Stack>
            <Typography
              sx={{
                fontSize: 14,
                color: tokens.neutral[500],
                mb: 1.5,
              }}
            >
              Choose where PDF and MCDX files are saved during batch execution.
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={settings.outputDirMode}
                onChange={handleOutputDirModeChange}
                sx={{
                  fontSize: 13,
                  backgroundColor: tokens.surface.canvas,
                  '.MuiSelect-select': {
                    py: 1,
                    px: 1.5,
                  },
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: tokens.neutral[200],
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: tokens.primary[300],
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: tokens.primary[500],
                  },
                }}
                MenuProps={{
                  disablePortal: true,
                  PaperProps: {
                    sx: {
                      boxShadow: tokens.shadow.lg,
                    },
                  },
                }}
              >
                <MenuItem value="working" sx={{ fontSize: 13 }}>
                  Working Directory
                </MenuItem>
                <MenuItem value="source" sx={{ fontSize: 13 }}>
                  Same as Source
                </MenuItem>
                <MenuItem value="custom" sx={{ fontSize: 13 }}>
                  Custom Location
                </MenuItem>
              </Select>
            </FormControl>
            {customPathError && (
              <Typography
                sx={{
                  color: tokens.error.main,
                  fontSize: 14,
                  mt: 1,
                }}
              >
                {customPathError}
              </Typography>
            )}
            {settings.outputDirMode === 'custom' && settings.customOutputDir && (
              <Typography
                sx={{
                  fontSize: 14,
                  color: tokens.neutral[500],
                  mt: 1,
                  wordBreak: 'break-all',
                }}
              >
                {settings.customOutputDir}
              </Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: tokens.neutral[100] }} />

          {/* Info note */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: tokens.radius.sm,
              backgroundColor: tokens.primary[50],
              border: `1px solid ${tokens.primary[100]}`,
            }}
          >
            <Typography
              sx={{
                fontSize: 14,
                color: tokens.primary[700],
              }}
            >
              Settings are shared with the Workflow view. Changes apply to both batch and workflow execution.
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}

