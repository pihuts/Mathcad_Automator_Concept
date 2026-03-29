import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { tokens, cssVariables, darkTokens, darkCssVariables } from './mui-theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  theme: Theme;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to create MUI theme from tokens
const createAppTheme = (isDark: boolean): Theme => {
  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: tokens.primary[700],
        light: tokens.primary[100],
        dark: tokens.primary[800],
        contrastText: tokens.neutral[0],
      },
      secondary: {
        main: tokens.primary[600],
        light: tokens.primary[200],
        dark: tokens.primary[900],
        contrastText: tokens.neutral[0],
      },
      background: {
        default: isDark ? darkTokens.surface.canvas : tokens.surface.canvas,
        paper: isDark ? darkTokens.surface.paper : tokens.surface.paper,
      },
      text: {
        primary: isDark ? darkTokens.neutral[100] : tokens.neutral[800],
        secondary: isDark ? darkTokens.neutral[400] : tokens.neutral[500],
        disabled: isDark ? darkTokens.neutral[500] : tokens.neutral[400],
      },
      grey: {
        50: isDark ? darkTokens.neutral[50] : tokens.neutral[50],
        100: isDark ? darkTokens.neutral[100] : tokens.neutral[100],
        200: isDark ? darkTokens.neutral[200] : tokens.neutral[200],
        300: isDark ? darkTokens.neutral[300] : tokens.neutral[300],
        400: isDark ? darkTokens.neutral[400] : tokens.neutral[400],
        500: isDark ? darkTokens.neutral[500] : tokens.neutral[500],
        600: isDark ? darkTokens.neutral[600] : tokens.neutral[600],
        700: isDark ? darkTokens.neutral[700] : tokens.neutral[700],
        800: isDark ? darkTokens.neutral[800] : tokens.neutral[800],
        900: isDark ? darkTokens.neutral[900] : tokens.neutral[900],
      },
      success: {
        main: tokens.success.main,
        light: isDark ? darkTokens.status.success.light : tokens.success.light,
        dark: tokens.success.dark,
      },
      warning: {
        main: tokens.warning.main,
        light: isDark ? darkTokens.status.warning.light : tokens.warning.light,
        dark: tokens.warning.dark,
      },
      error: {
        main: tokens.error.main,
        light: isDark ? darkTokens.status.error.light : tokens.error.light,
        dark: tokens.error.dark,
      },
      info: {
        main: tokens.info.main,
        light: isDark ? darkTokens.status.info.light : tokens.info.light,
        dark: tokens.info.dark,
      },
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontSize: 16,
      fontFamily: "'Outfit', 'Lexend', system-ui, sans-serif",
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 800 },
      body1: { fontSize: '1rem' },
      body2: { fontSize: '0.875rem' },
      subtitle2: {
        fontWeight: 600,
        color: isDark ? darkTokens.neutral[400] : tokens.neutral[500],
      },
      caption: {
        fontSize: '0.75rem',
      },
      overline: {
        fontSize: '0.85rem',
        letterSpacing: '0.08em',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            color: isDark ? darkTokens.neutral[100] : tokens.neutral[800],
            backgroundColor: isDark ? darkTokens.surface.canvas : tokens.surface.canvas,
          },
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: 'transparent transparent',
            '&:hover': {
              scrollbarColor: isDark ? 'rgba(255, 255, 255, 0.2) transparent' : 'rgba(0, 0, 0, 0.2) transparent',
            },
          },
          '*::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '*::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '*::-webkit-scrollbar-thumb': {
            background: 'transparent',
            borderRadius: '4px',
          },
          '*:hover::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
          },
          '*:hover::-webkit-scrollbar-thumb:hover': {
            background: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.full,
            paddingLeft: 24,
            paddingRight: 24,
            transition: 'transform 150ms ease, background-color 150ms ease',
            textTransform: 'none',
            fontWeight: 600,
            willChange: 'transform',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
            '&:focus-visible': {
              outline: `2px solid ${tokens.primary[700]}`,
              outlineOffset: '2px',
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              '&:hover': {
                transform: 'none',
              },
              '&:active': {
                transform: 'none',
              },
            },
          },
          containedPrimary: {
            backgroundColor: tokens.primary[700],
            boxShadow: `0 2px 8px var(--alpha-primary-20, rgba(4, 120, 87, 0.2))`,
            '&:hover': {
              backgroundColor: tokens.primary[800],
              boxShadow: `0 4px 12px var(--alpha-primary-30, rgba(4, 120, 87, 0.3))`,
            },
            '&:active': {
              boxShadow: `0 1px 4px var(--alpha-primary-20, rgba(4, 120, 87, 0.2))`,
            },
          },
          outlinedPrimary: {
            borderColor: `var(--alpha-primary-20, rgba(4, 120, 87, 0.2))`,
            color: tokens.primary[700],
            '&:hover': {
              backgroundColor: `var(--alpha-primary-4, rgba(4, 120, 87, 0.04))`,
              borderColor: tokens.primary[700],
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.sm,
            fontWeight: 600,
            minHeight: 32,
            fontSize: '0.875rem',
            paddingInline: 12,
            transition: 'transform 150ms ease, background-color 150ms ease',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:focus-visible': {
              outline: `2px solid ${tokens.primary[700]}`,
              outlineOffset: '1px',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadow.sm,
            transition: 'box-shadow 150ms ease, border-color 150ms ease',
          },
          elevation1: {
            boxShadow: tokens.shadow.sm,
          },
          elevation2: {
            boxShadow: tokens.shadow.md,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.lg,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.xl,
            boxShadow: tokens.shadow.xl,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            '&.Mui-selected': {
              backgroundColor: isDark ? darkTokens.surface.paper : tokens.neutral[0],
              color: tokens.primary[700],
              fontWeight: 600,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `2px solid ${tokens.primary[700]}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `2px solid ${tokens.primary[700]}`,
              outlineOffset: '2px',
            },
          },
        },
      },
    },
  });
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme-mode');
    return (stored as ThemeMode) || 'system';
  });

  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedMode = mode === 'system' ? systemPreference : mode;

  // Apply CSS variables based on resolved mode
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedMode);

    // Remove old theme variables if they exist
    const oldStyle = document.getElementById('theme-variables');
    if (oldStyle) {
      oldStyle.remove();
    }

    // Apply appropriate CSS variables
    const style = document.createElement('style');
    style.id = 'theme-variables';
    style.textContent = resolvedMode === 'dark' ? darkCssVariables : cssVariables;

    document.head.appendChild(style);
  }, [resolvedMode]);

  const theme = useMemo(() => createAppTheme(resolvedMode === 'dark'), [resolvedMode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  const toggleTheme = () => {
    const nextMode = resolvedMode === 'light' ? 'dark' : 'light';
    setMode(nextMode);
  };

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      theme,
      toggleTheme,
      setMode,
    }),
    [mode, resolvedMode, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
