import { createTheme, alpha } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import type {} from '@mui/x-data-grid/themeAugmentation';

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            primary: { main: '#7C3AED' },
            secondary: { main: '#06B6D4' },
            background: {
              default: '#0F0F13',
              paper: '#1A1A24',
            },
            text: {
              primary: '#F1F5F9',
              secondary: '#94A3B8',
            },
            divider: 'rgba(255,255,255,0.08)',
          }
        : {
            primary: { main: '#7C3AED' },
            secondary: { main: '#0891B2' },
            background: {
              default: '#F8FAFC',
              paper: '#FFFFFF',
            },
            text: {
              primary: '#0F172A',
              secondary: '#64748B',
            },
            divider: 'rgba(0,0,0,0.08)',
          }),
    },
    typography: {
      fontFamily: '"DM Sans", "Inter", sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontWeight: 600, letterSpacing: '-0.01em' },
      h4: { fontWeight: 600, letterSpacing: '-0.01em' },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0px)' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }: { theme: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: mode === 'dark'
              ? '0 4px 24px rgba(0,0,0,0.4)'
              : '0 4px 24px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            '&:hover': {
              boxShadow: mode === 'dark'
                ? '0 8px 32px rgba(124,58,237,0.2)'
                : '0 8px 32px rgba(124,58,237,0.12)',
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6 },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }: { theme: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) => ({
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 12,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: mode === 'dark'
                ? alpha('#7C3AED', 0.1)
                : alpha('#7C3AED', 0.05),
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: mode === 'dark'
                ? alpha('#7C3AED', 0.08)
                : alpha('#7C3AED', 0.04),
              cursor: 'pointer',
            },
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }: { theme: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) => ({
            backgroundImage: 'none',
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }: { theme: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ }) => ({
            backgroundImage: 'none',
            backgroundColor: mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.8)
              : alpha(theme.palette.background.paper, 0.9),
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${theme.palette.divider}`,
            boxShadow: 'none',
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
