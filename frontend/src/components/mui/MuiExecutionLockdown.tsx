import React from 'react';
import { Box, Typography, Button, LinearProgress, Paper, Stack, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { StopCircle as StopCircleIcon } from '@mui/icons-material';
import { tokens } from '../../theme/mui-theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface MuiExecutionLockdownProps {
  active: boolean;
  onCancel: () => void;
  statusText?: string;
  progress?: number; // 0 to 100
}

const MuiExecutionLockdown: React.FC<MuiExecutionLockdownProps> = ({
  active,
  onCancel,
  statusText = 'Execution in Progress...',
  progress,
}) => {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // Skip rendering entirely if not active
  if (!active) return null;

  // Use theme-aware colors for dark mode support
  const overlayStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: tokens.zIndex.modal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(0, 0, 0, 0.7)'
      : 'rgba(0, 0, 0, 0.5)',
  };

  const paperStyle = {
    p: 4,
    borderRadius: tokens.radius.xl,
    textAlign: 'center' as const,
    maxWidth: 'min(400px, 90%)',
    width: '90%',
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.paper',
  };

  // Static version for reduced motion preference
  if (prefersReducedMotion) {
    return (
      <Box sx={overlayStyle}>
        <Paper elevation={6} sx={paperStyle}>
          <LockdownContent
            statusText={statusText}
            progress={progress}
            onCancel={onCancel}
          />
        </Paper>
      </Box>
    );
  }

  // Animated version using transform for GPU acceleration
  return (
    <AnimatePresence>
      {active && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          sx={overlayStyle}
        >
          <Paper
            component={motion.div}
            elevation={6}
            initial={{ opacity: 0, transform: 'scale(0.95)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transform: 'scale(0.95)' }}
            transition={{ duration: 0.15 }}
            sx={paperStyle}
          >
            <LockdownContent
              statusText={statusText}
              progress={progress}
              onCancel={onCancel}
            />
          </Paper>
        </Box>
      )}
    </AnimatePresence>
  );
};

// Extract content to avoid re-creating on each render
const LockdownContent: React.FC<{
  statusText: string;
  progress?: number;
  onCancel: () => void;
}> = ({ statusText, progress, onCancel }) => (
  <Stack spacing={3} alignItems="center">
    <Typography variant="h6" fontWeight="600" color="primary">
      {statusText}
    </Typography>

    <Box sx={{ width: '100%' }}>
      <LinearProgress
        variant={progress !== undefined ? "determinate" : "indeterminate"}
        value={progress}
        sx={{
          height: 10,
          borderRadius: 5,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 5,
          }
        }}
      />
    </Box>

    <Typography variant="body2" color="text.secondary">
      Please wait while Mathcad processes your workflow.
    </Typography>

    <Button
      variant="contained"
      color="error"
      startIcon={<StopCircleIcon />}
      onClick={onCancel}
      size="large"
      sx={{
        borderRadius: tokens.radius.md,
        px: 4,
        fontWeight: 'bold',
        boxShadow: tokens.shadow.md,
      }}
    >
      CANCEL EXECUTION
    </Button>
  </Stack>
);

export default MuiExecutionLockdown;
