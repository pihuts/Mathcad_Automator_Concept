import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  ButtonBase,
  LinearProgress,
  CircularProgress,
  Chip,
  Collapse,
  Tooltip
} from '@mui/material';
import {
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Timer as TimerIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PauseCircle as EarlyStopIcon,
  Refresh as RestartIcon,
  TrendingDown as AdaptiveIcon,
  CompareArrows as CrossGroupIcon,
  Memory as SamplerIcon
} from '@mui/icons-material';
import { tokens } from '../theme/mui-theme';

export interface CompactStatusCardProps {
  progress: number;           // 0-100
  completed: number;
  total: number;
  elapsed: number;            // seconds
  currentTrial?: number;
  currentStage?: number;
  totalStages?: number;
  eta?: string;
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'error';
  message?: string;
  features?: {
    earlyStopping?: boolean;
    adaptiveShrink?: boolean;
    restartActive?: boolean;
    crossGroupValidation?: boolean;
    sampler?: 'gpsampler' | 'tpe';
    samplerReason?: string;
  };
  onStop?: () => void;
  onStart?: () => void;
  isStarting?: boolean;
  isStopping?: boolean;
}

// Format elapsed time as HH:MM:SS
const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const CompactStatusCard: React.FC<CompactStatusCardProps> = ({
  progress,
  completed,
  total,
  elapsed,
  currentTrial,
  currentStage,
  totalStages,
  eta,
  status,
  message,
  features,
  onStop,
  onStart,
  isStarting = false,
  isStopping = false
}) => {
  const [displayElapsed, setDisplayElapsed] = useState(elapsed);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  // Update display elapsed when prop changes
  useEffect(() => {
    setDisplayElapsed(elapsed);
  }, [elapsed]);

  // Increment elapsed time locally while running for smooth display
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(() => {
      setDisplayElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Determine progress bar color
  const getProgressColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'stopped':
        return 'warning';
      default:
        return 'primary';
    }
  };

  // Has any features to show
  const hasFeatures = features && (
    features.earlyStopping ||
    features.adaptiveShrink ||
    features.restartActive ||
    features.crossGroupValidation ||
    features.sampler
  );

  return (
    <Paper
      elevation={0}
      aria-busy={status === 'running'}
      role="region"
      aria-label={`Progress: ${Math.round(progress)}% complete, ${completed} of ${total} done`}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: status === 'error' ? 'error.200' : 'grey.200',
        overflow: 'hidden'
      }}
    >
      {/* Progress bar */}
      <LinearProgress
        variant={status === 'running' ? 'indeterminate' : 'determinate'}
        value={progress}
        color={getProgressColor()}
        sx={{
          height: 4,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            transition: 'transform 0.3s ease'
          }
        }}
      />

      <Box sx={{ p: 2 }}>
        {/* Header row */}
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Progress percentage */}
          <Box sx={{ minWidth: 50 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: status === 'completed' ? 'success.main' :
                  status === 'error' ? 'error.main' : 'primary.main'
              }}
            >
              {Math.round(progress)}%
            </Typography>
          </Box>

          {/* Stats row */}
          <Stack
            direction="row"
            spacing={2}
            divider={<Box sx={{ width: 1, height: 32, bgcolor: 'grey.200' }} />}
            sx={{ flex: 1, alignItems: 'center' }}
          >
            {/* Completed/Total */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {completed}/{total}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                done
              </Typography>
            </Stack>

            {/* Elapsed time */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TimerIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography
                variant="caption"
                sx={{ fontFamily: tokens.fontStack.mono, fontWeight: 500, color: 'text.primary' }}
              >
                {formatElapsedTime(displayElapsed)}
              </Typography>
            </Stack>

            {currentTrial !== undefined && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Trial
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  #{currentTrial}
                </Typography>
              </Stack>
            )}

            {/* Current stage */}
            {currentStage !== undefined && totalStages !== undefined && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Stage
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {currentStage === 0 ? 'Feasibility' : `${currentStage}/${totalStages}`}
                </Typography>
              </Stack>
            )}

            {/* ETA */}
            {eta && status === 'running' && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  ~
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  {eta}
                </Typography>
              </Stack>
            )}
          </Stack>

          {/* Action button */}
          {status === 'running' ? (
            <Button
              startIcon={isStopping ? <CircularProgress size={16} color="inherit" /> : <StopIcon />}
              color="error"
              variant="outlined"
              size="small"
              onClick={onStop}
              disabled={isStopping}
              sx={{ minWidth: 80 }}
            >
              {isStopping ? 'Stopping...' : 'STOP'}
            </Button>
          ) : (
            onStart && (
              <Button
                startIcon={isStarting ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                color="primary"
                variant="contained"
                size="small"
                onClick={onStart}
                disabled={isStarting}
                sx={{ minWidth: 80 }}
              >
                {isStarting ? 'Starting...' : 'START'}
              </Button>
            )
          )}
        </Stack>

        {/* Features toggle */}
        {hasFeatures && (
          <Box sx={{ mt: 1.5 }}>
            <ButtonBase
              onClick={() => setFeaturesExpanded(!featuresExpanded)}
              aria-expanded={featuresExpanded}
              aria-controls="features-content"
              sx={{
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                display: 'flex',
                flexDirection: 'row',
                gap: 0.5,
                alignItems: 'center',
                '&:hover': { bgcolor: 'grey.50' },
                '&:focus-visible': {
                  outline: '2px solid var(--color-primary)',
                  outlineOffset: '2px',
                },
                borderRadius: 1,
                px: 0.5,
                py: 0.25,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                Features
              </Typography>
              {featuresExpanded ? (
                <CollapseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              ) : (
                <ExpandIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              )}
            </ButtonBase>

            <Collapse in={featuresExpanded} id="features-content">
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}
                useFlexGap
              >
                {features?.earlyStopping && (
                  <Tooltip title="Early stopping enabled" arrow>
                    <Chip
                      icon={<EarlyStopIcon sx={{ fontSize: 14 }} />}
                      label="Early Stop"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ height: 32, fontSize: '0.875rem', marginY: 0.5 }}
                    />
                  </Tooltip>
                )}
                {features?.adaptiveShrink && (
                  <Tooltip title="Adaptive shrink factor enabled" arrow>
                    <Chip
                      icon={<AdaptiveIcon sx={{ fontSize: 14 }} />}
                      label="Adaptive"
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ height: 32, fontSize: '0.875rem', marginY: 0.5 }}
                    />
                  </Tooltip>
                )}
                {features?.restartActive && (
                  <Tooltip title="Restart mechanism active" arrow>
                    <Chip
                      icon={<RestartIcon sx={{ fontSize: 14 }} />}
                      label="Restart"
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ height: 32, fontSize: '0.875rem', marginY: 0.5 }}
                    />
                  </Tooltip>
                )}
                {features?.crossGroupValidation && (
                  <Tooltip title="Cross-group validation enabled" arrow>
                    <Chip
                      icon={<CrossGroupIcon sx={{ fontSize: 14 }} />}
                      label="Cross-Group"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ height: 32, fontSize: '0.875rem', marginY: 0.5 }}
                    />
                  </Tooltip>
                )}
                {features?.sampler && (
                  <Tooltip
                    title={
                      features.sampler === 'gpsampler'
                        ? 'GPSampler active - Gaussian Process Bayesian Optimization'
                        : features.samplerReason || 'TPE Fallback active'
                    }
                    arrow
                  >
                    <Chip
                      icon={<SamplerIcon sx={{ fontSize: 14 }} />}
                      label={features.sampler === 'gpsampler' ? 'GPSampler' : 'TPE'}
                      size="small"
                      color={features.sampler === 'gpsampler' ? 'primary' : 'warning'}
                      variant={features.sampler === 'gpsampler' ? 'filled' : 'outlined'}
                      sx={{ height: 32, fontSize: '0.875rem', marginY: 0.5 }}
                    />
                  </Tooltip>
                )}
              </Stack>
            </Collapse>
          </Box>
        )}

        {/* Status message */}
        {message && status === 'running' && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1,
              color: 'text.secondary',
              fontStyle: 'italic',
              fontSize: '0.875rem'
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};


