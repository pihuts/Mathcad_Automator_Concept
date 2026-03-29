import { createTheme } from '@mui/material/styles';

/**
 * Mathcad Automator Design System
 * Jade Ribbon Theme - Single Source of Truth
 *
 * This file defines all design tokens. CSS custom properties are generated
 * from these values for use in non-MUI components and CSS modules.
 *
 * DO NOT define colors in other files. Import from here or use CSS variables.
 */

// ============================================
// DESIGN TOKENS - Single Source of Truth
// ============================================

export const tokens = {
  // Primary Brand Colors - Jade Green
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#047857',  // Main brand color
    800: '#166534',
    900: '#14532d',
  },

  // Secondary Accent - Teal/Cyan for interactive elements
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Semantic Status Colors
  success: {
    light: '#dcfce7',
    main: '#16a34a',
    dark: '#166534',
    contrast: '#ffffff',
    border: '#A8DAB5',    // Light green border for pills
    hoverLight: '#c8e6c9', // Hover state for light backgrounds
    hoverBorder: '#81c995', // Hover state for borders
  },
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#b45309',
    contrast: '#ffffff',
    border: '#FCD34D',    // Amber border for pills
    hoverLight: '#fef3c7', // Hover state for light backgrounds
    hoverBorder: '#fcd34d', // Hover state for borders
    chip: '#ffe0b2',      // Chip background color
    chipText: '#e65100',  // Chip text color
  },
  error: {
    light: '#fee2e2',
    main: '#dc2626',
    dark: '#991b1b',
    contrast: '#ffffff',
    border: '#FECACA',    // Light red border for pills
    hoverLight: '#fee2e2', // Hover state for light backgrounds
    hoverBorder: '#fca5a5', // Hover state for borders
  },
  info: {
    light: '#f3e8ff',
    main: '#7c3aed',
    dark: '#6d28d9',
    contrast: '#ffffff',
    border: '#E9D5FF',    // Light purple border for pills
    hoverLight: '#ede9fe', // Hover state for light backgrounds
    hoverBorder: '#c4b5fd', // Hover state for borders
  },

  // Alpha/Opacity Colors - for overlays, shadows, and glow effects
  alpha: {
    primary: {
      4: 'rgba(4, 120, 87, 0.04)',   // Subtle background tint
      8: 'rgba(4, 120, 87, 0.08)',   // Light background
      10: 'rgba(4, 120, 87, 0.10)',  // Border hover
      15: 'rgba(4, 120, 87, 0.15)',  // Row hover
      20: 'rgba(4, 120, 87, 0.20)',  // Selected row
      30: 'rgba(4, 120, 87, 0.30)',  // Border active
      40: 'rgba(4, 120, 87, 0.40)',  // Glow effect
    },
    info: {
      4: 'rgba(124, 58, 237, 0.04)',
      8: 'rgba(124, 58, 237, 0.08)',
      10: 'rgba(124, 58, 237, 0.10)',
      15: 'rgba(124, 58, 237, 0.15)',
      20: 'rgba(124, 58, 237, 0.20)',
      30: 'rgba(124, 58, 237, 0.30)',
      40: 'rgba(124, 58, 237, 0.40)',
    },
    neutral: {
      4: 'rgba(0, 0, 0, 0.04)',    // Subtle background
      8: 'rgba(0, 0, 0, 0.08)',    // Light border
      10: 'rgba(0, 0, 0, 0.10)',   // Divider
      12: 'rgba(0, 0, 0, 0.12)',   // Border default
    },
  },

  // Neutral Palette - Warm-tinted (not pure gray)
  neutral: {
    0: '#fefefe',   // Off-white (tinted)
    50: '#f8fafc',  // Canvas background
    100: '#f1f5f9', // Surface hover
    200: '#e2e8f0', // Borders
    300: '#cbd5e1', // Dividers
    400: '#94a3b8', // Disabled text
    500: '#64748b', // Secondary text
    600: '#475569', // Muted text / Tech labels
    700: '#334155', // Body text
    800: '#1e293b', // Primary text
    900: '#0f172a', // Heading text
  },

  // UI Element Colors - For specific component elements
  ui: {
    techLabel: '#505357',      // Uppercase section labels
    dataFlowBg: '#f8f9fa',     // Data flow card backgrounds
    linkBlue: '#1a73e8',       // Link colors
    successGreen: '#2e7d32',   // Success text/link colors
  },

  // Surface Colors
  surface: {
    canvas: '#f0f4f0',      // App background (tinted with green)
    paper: '#fefefe',       // Card backgrounds
    elevated: '#ffffff',    // Elevated surfaces
    overlay: 'rgba(0,0,0,0.5)', // Modal backdrop
  },

  // Typography Scale (modular scale 1.25)
  fontSize: {
    xs: '0.875rem',    // 14px
    sm: '0.95rem',     // 15.2px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },

  // Font Stacks
  fontStack: {
    mono: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
  },

  // Spacing Scale (8px base)
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
  },

  // Border Radius
  radius: {
    none: '0',
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px
    base: '0.875rem', // 14px - common input/button radius
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',  // Pill shape
  },

  // Shadows
  shadow: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },

  // Transitions
  transition: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },

  // Z-Index Scale (stacking contexts)
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 100,
    modal: 1000,
    tooltip: 1500,
    toast: 2000,
  },

  // Pill dimensions
  pill: {
    maxWidth: '280px',
  },
} as const;

// ============================================
// CSS CUSTOM PROPERTIES GENERATOR
// ============================================

/**
 * Generates CSS custom property string from tokens
 * Call this in :root to make tokens available to CSS
 */
export const cssVariables = `
:root {
  /* Primary Colors */
  --color-primary-50: ${tokens.primary[50]};
  --color-primary-100: ${tokens.primary[100]};
  --color-primary-200: ${tokens.primary[200]};
  --color-primary-300: ${tokens.primary[300]};
  --color-primary-400: ${tokens.primary[400]};
  --color-primary-500: ${tokens.primary[500]};
  --color-primary-600: ${tokens.primary[600]};
  --color-primary-700: ${tokens.primary[700]};
  --color-primary-800: ${tokens.primary[800]};
  --color-primary-900: ${tokens.primary[900]};

  /* Accent Colors */
  --color-accent-50: ${tokens.accent[50]};
  --color-accent-100: ${tokens.accent[100]};
  --color-accent-200: ${tokens.accent[200]};
  --color-accent-300: ${tokens.accent[300]};
  --color-accent-400: ${tokens.accent[400]};
  --color-accent-500: ${tokens.accent[500]};
  --color-accent-600: ${tokens.accent[600]};
  --color-accent-700: ${tokens.accent[700]};
  --color-accent-800: ${tokens.accent[800]};
  --color-accent-900: ${tokens.accent[900]};

  /* Status Colors */
  --color-success-light: ${tokens.success.light};
  --color-success-main: ${tokens.success.main};
  --color-success-dark: ${tokens.success.dark};
  --color-success-border: ${tokens.success.border};
  --color-success-hoverLight: ${tokens.success.hoverLight};
  --color-success-hoverBorder: ${tokens.success.hoverBorder};
  --color-warning-light: ${tokens.warning.light};
  --color-warning-main: ${tokens.warning.main};
  --color-warning-dark: ${tokens.warning.dark};
  --color-warning-border: ${tokens.warning.border};
  --color-warning-hoverLight: ${tokens.warning.hoverLight};
  --color-warning-hoverBorder: ${tokens.warning.hoverBorder};
  --color-error-light: ${tokens.error.light};
  --color-error-main: ${tokens.error.main};
  --color-error-dark: ${tokens.error.dark};
  --color-error-border: ${tokens.error.border};
  --color-error-hoverLight: ${tokens.error.hoverLight};
  --color-error-hoverBorder: ${tokens.error.hoverBorder};
  --color-info-light: ${tokens.info.light};
  --color-info-main: ${tokens.info.main};
  --color-info-dark: ${tokens.info.dark};
  --color-info-border: ${tokens.info.border};
  --color-info-hoverLight: ${tokens.info.hoverLight};
  --color-info-hoverBorder: ${tokens.info.hoverBorder};

  /* Neutral Colors */
  --color-neutral-0: ${tokens.neutral[0]};
  --color-neutral-50: ${tokens.neutral[50]};
  --color-neutral-100: ${tokens.neutral[100]};
  --color-neutral-200: ${tokens.neutral[200]};
  --color-neutral-300: ${tokens.neutral[300]};
  --color-neutral-400: ${tokens.neutral[400]};
  --color-neutral-500: ${tokens.neutral[500]};
  --color-neutral-600: ${tokens.neutral[600]};
  --color-neutral-700: ${tokens.neutral[700]};
  --color-neutral-800: ${tokens.neutral[800]};
  --color-neutral-900: ${tokens.neutral[900]};

  /* Surface Colors */
  --surface-canvas: ${tokens.surface.canvas};
  --surface-paper: ${tokens.surface.paper};
  --surface-elevated: ${tokens.surface.elevated};
  --surface-overlay: ${tokens.surface.overlay};

  /* Semantic Aliases (most commonly used) */
  --color-primary: ${tokens.primary[700]};
  --color-primary-light: ${tokens.primary[100]};
  --color-primary-dark: ${tokens.primary[800]};
  --color-accent: ${tokens.accent[500]};
  --color-text-primary: ${tokens.neutral[800]};
  --color-text-secondary: ${tokens.neutral[500]};
  --color-text-muted: ${tokens.neutral[400]};
  --color-border: ${tokens.neutral[200]};
  --color-border-light: ${tokens.neutral[100]};

  /* Typography */
  --font-mono: ${tokens.fontStack.mono};

  /* Spacing */
  --space-1: ${tokens.spacing[1]};
  --space-2: ${tokens.spacing[2]};
  --space-3: ${tokens.spacing[3]};
  --space-4: ${tokens.spacing[4]};
  --space-5: ${tokens.spacing[5]};
  --space-6: ${tokens.spacing[6]};
  --space-8: ${tokens.spacing[8]};
  --space-10: ${tokens.spacing[10]};
  --space-12: ${tokens.spacing[12]};

  /* Border Radius */
  --radius-sm: ${tokens.radius.sm};
  --radius-md: ${tokens.radius.md};
  --radius-lg: ${tokens.radius.lg};
  --radius-xl: ${tokens.radius.xl};
  --radius-full: ${tokens.radius.full};

  /* Shadows */
  --shadow-sm: ${tokens.shadow.sm};
  --shadow-md: ${tokens.shadow.md};
  --shadow-lg: ${tokens.shadow.lg};
  --shadow-xl: ${tokens.shadow.xl};

  /* Transitions */
  --transition-fast: ${tokens.transition.fast};
  --transition-normal: ${tokens.transition.normal};
  --transition-slow: ${tokens.transition.slow};

  /* Z-Index Scale */
  --z-base: ${tokens.zIndex.base};
  --z-dropdown: ${tokens.zIndex.dropdown};
  --z-sticky: ${tokens.zIndex.sticky};
  --z-modal: ${tokens.zIndex.modal};
  --z-tooltip: ${tokens.zIndex.tooltip};
  --z-toast: ${tokens.zIndex.toast};

  /* UI Element Colors */
  --ui-tech-label: ${tokens.ui.techLabel};
  --ui-data-flow-bg: ${tokens.ui.dataFlowBg};
  --ui-link-blue: ${tokens.ui.linkBlue};
  --ui-success-green: ${tokens.ui.successGreen};

  /* Alpha Colors */
  --alpha-primary-4: ${tokens.alpha.primary[4]};
  --alpha-primary-8: ${tokens.alpha.primary[8]};
  --alpha-primary-10: ${tokens.alpha.primary[10]};
  --alpha-primary-15: ${tokens.alpha.primary[15]};
  --alpha-primary-20: ${tokens.alpha.primary[20]};
  --alpha-primary-30: ${tokens.alpha.primary[30]};
  --alpha-primary-40: ${tokens.alpha.primary[40]};
  --alpha-info-4: ${tokens.alpha.info[4]};
  --alpha-info-8: ${tokens.alpha.info[8]};
  --alpha-info-10: ${tokens.alpha.info[10]};
  --alpha-info-15: ${tokens.alpha.info[15]};
  --alpha-info-20: ${tokens.alpha.info[20]};
  --alpha-info-30: ${tokens.alpha.info[30]};
  --alpha-info-40: ${tokens.alpha.info[40]};
  --alpha-neutral-4: ${tokens.alpha.neutral[4]};
  --alpha-neutral-8: ${tokens.alpha.neutral[8]};
  --alpha-neutral-10: ${tokens.alpha.neutral[10]};
  --alpha-neutral-12: ${tokens.alpha.neutral[12]};
}
`;

// ============================================
// MUI THEME CONFIGURATION
// ============================================

const muiTheme = createTheme({
  palette: {
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
      default: tokens.surface.canvas,
      paper: tokens.surface.paper,
    },
    text: {
      primary: tokens.neutral[800],
      secondary: tokens.neutral[500],
      disabled: tokens.neutral[400],
    },
    grey: {
      50: tokens.neutral[50],
      100: tokens.neutral[100],
      200: tokens.neutral[200],
      300: tokens.neutral[300],
      400: tokens.neutral[400],
      500: tokens.neutral[500],
      600: tokens.neutral[600],
      700: tokens.neutral[700],
      800: tokens.neutral[800],
      900: tokens.neutral[900],
    },
    success: {
      main: tokens.success.main,
      light: tokens.success.light,
      dark: tokens.success.dark,
    },
    warning: {
      main: tokens.warning.main,
      light: tokens.warning.light,
      dark: tokens.warning.dark,
    },
    error: {
      main: tokens.error.main,
      light: tokens.error.light,
      dark: tokens.error.dark,
    },
    info: {
      main: tokens.info.main,
      light: tokens.info.light,
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
    body2: { fontSize: '0.95rem' },
    subtitle2: {
      fontWeight: 600,
      color: tokens.neutral[500],
    },
    caption: {
      fontSize: '0.875rem',
      fontFamily: "'Outfit', 'Lexend', system-ui, sans-serif",
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
          color: tokens.neutral[800],
          backgroundColor: tokens.surface.canvas,
        },
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
          '&:hover': {
            scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
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
          background: 'rgba(0, 0, 0, 0.15)',
        },
        '*:hover::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(0, 0, 0, 0.25)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.full,
          paddingLeft: 24,
          paddingRight: 24,
          transition: 'transform 150ms ease, background-color 150ms ease, box-shadow 150ms ease',
          textTransform: 'none',
          fontWeight: 600,
          '&:hover': {
            // Only lift up — the actual transform is per-variant below
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          '&:focus-visible': {
            outline: `2px solid ${tokens.primary[700]}`,
            outlineOffset: '2px',
          },
        },
        containedPrimary: {
          backgroundColor: tokens.primary[700],
          boxShadow: tokens.shadow.md,
          '&:hover': {
            backgroundColor: tokens.primary[800],
            boxShadow: tokens.shadow.lg,
            transform: 'translateY(-2px)',
          },
          '&:active': {
            boxShadow: tokens.shadow.sm,
            transform: 'translateY(0)',
          },
        },
        outlinedPrimary: {
          borderColor: tokens.alpha.primary[20],
          color: tokens.primary[700],
          '&:hover': {
            backgroundColor: tokens.alpha.primary[4],
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
            backgroundColor: tokens.neutral[0],
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

export default muiTheme;

// Export tokens for direct access in components
export const {
  primary,
  accent,
  success,
  warning,
  error,
  info,
  neutral,
  surface,
  fontSize,
  fontStack,
  spacing,
  radius,
  shadow,
  transition,
  zIndex,
} = tokens;

// ============================================
// DARK MODE TOKENS
// ============================================

export const darkTokens = {
  surface: {
    canvas: '#0f172a',
    paper: '#1e293b',
    elevated: '#334155',
    overlay: 'rgba(0,0,0,0.7)',
  },
  neutral: {
    0: '#fefefe',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  // Primary colors for dark mode - desaturated jade
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#047857',  // Main brand color
    800: '#166534',
    900: '#14532d',
  },
  // Accent colors for dark mode - desaturated teal
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  // Status colors for dark mode - darker backgrounds with same hues
  status: {
    success: { light: '#1a2d1a', main: '#22c55e', dark: '#166534' },
    warning: { light: '#3d2a0a', main: '#f59e0b', dark: '#b45309' },
    error: { light: '#3d0a0a', main: '#dc2626', dark: '#991b1b' },
    info: { light: '#2a0a3d', main: '#7c3aed', dark: '#6d28d9' },
  },
} as const;

// ============================================
// DARK MODE CSS VARIABLES
// ============================================

export const darkCssVariables = `
:root {
  /* Surface Colors - Dark Mode */
  --surface-canvas: ${darkTokens.surface.canvas};
  --surface-paper: ${darkTokens.surface.paper};
  --surface-elevated: ${darkTokens.surface.elevated};
  --surface-overlay: ${darkTokens.surface.overlay};

  /* Text Colors - Dark Mode */
  --color-text-primary: ${darkTokens.neutral[100]};
  --color-text-secondary: ${darkTokens.neutral[400]};
  --color-text-muted: ${darkTokens.neutral[500]};
  --color-border: ${darkTokens.neutral[700]};
  --color-border-light: ${darkTokens.neutral[600]};

  /* Primary Palette - Dark Mode (muted jade on dark surfaces) */
  --color-primary-50: #052e16;
  --color-primary-100: #14532d;
  --color-primary-200: #166534;
  --color-primary-300: #1a7f3f;
  --color-primary-400: #22a055;
  --color-primary-500: #22c55e;
  --color-primary-600: #4ade80;
  --color-primary-700: #86efac;
  --color-primary-800: #bbf7d0;
  --color-primary-900: #dcfce7;

  /* Status Colors - Dark Mode (keep same hue but darker backgrounds) */
  --color-success-light: #1a2d1a;
  --color-warning-light: #3d2a0a;
  --color-error-light: #3d0a0a;
  --color-info-light: #2a0a3d;

  /* Alpha Colors - Dark Mode (desaturated for dark backgrounds) */
  --alpha-primary-4: rgba(4, 120, 87, 0.08);
  --alpha-primary-8: rgba(4, 120, 87, 0.12);
  --alpha-primary-10: rgba(4, 120, 87, 0.15);
  --alpha-primary-15: rgba(4, 120, 87, 0.20);
  --alpha-primary-20: rgba(4, 120, 87, 0.25);
  --alpha-primary-30: rgba(4, 120, 87, 0.35);
  --alpha-primary-40: rgba(4, 120, 87, 0.45);
  --alpha-info-4: rgba(124, 58, 237, 0.08);
  --alpha-info-8: rgba(124, 58, 237, 0.12);
  --alpha-info-10: rgba(124, 58, 237, 0.15);
  --alpha-info-15: rgba(124, 58, 237, 0.20);
  --alpha-info-20: rgba(124, 58, 237, 0.25);
  --alpha-info-30: rgba(124, 58, 237, 0.35);
  --alpha-info-40: rgba(124, 58, 237, 0.45);
}
`;
