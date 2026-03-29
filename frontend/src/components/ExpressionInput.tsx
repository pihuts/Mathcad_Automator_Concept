import { TextField, Typography, Stack } from '@mui/material';
import { useState, useRef, useCallback, useEffect } from 'react';
import { tokens } from '../theme/mui-theme';

interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  availableVariables: string[];
  label?: string;
  placeholder?: string;
  description?: string;
  validateFunction?: (expression: string, variables: string[]) => Promise<{ valid: boolean; error?: string }>;
}

export const ExpressionInput = ({
  value,
  onChange,
  availableVariables,
  label = 'CONDITION EXPRESSION',
  placeholder = 'e.g., (stress > 50000) AND (deflection < 2)',
  description,
  validateFunction,
}: ExpressionInputProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<any>(undefined);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!newValue.trim()) {
      setError(null);
      return;
    }

    // Debounce validation
    debounceRef.current = setTimeout(async () => {
      if (!validateFunction) {
        setError(null);
        return;
      }

      setIsValidating(true);
      try {
        const result = await validateFunction(newValue, availableVariables);
        setError(result.valid ? null : result.error || null);
      } catch {
        // Don't show network errors for validation
        setError(null);
      } finally {
        setIsValidating(false);
      }
    }, 500);
  }, [onChange, availableVariables, validateFunction]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Stack spacing={0.5}>
      <TextField
        label={label}
        value={value}
        onChange={handleChange}
        error={!!error}
        helperText={error || description || 'Use AND, OR, <, >, ==, !=, <=, >= operators'}
        placeholder={placeholder}
        fullWidth
        InputLabelProps={{
          sx: {
            fontFamily: 'Outfit, sans-serif',
            textTransform: 'uppercase',
            fontWeight: 700,
            fontSize: '0.875rem',
            letterSpacing: '0.15em',
            color: tokens.accent[500],
          }
        }}
        InputProps={{
          endAdornment: isValidating ? <Typography variant="caption" color="text.secondary">...</Typography> : null,
        }}
      />
      {availableVariables.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          Available: {availableVariables.join(', ')}
        </Typography>
      )}
    </Stack>
  );
};

