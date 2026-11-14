import { createTheme, responsiveFontSizes } from '@mui/material/styles';

export const lightTheme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#4f46e5', // Indigo
        light: '#6366f1',
        dark: '#4338ca',
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#0ea5e9', // Sky blue
        light: '#38bdf8',
        dark: '#0284c7'
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff'
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b'
      },
      divider: '#e2e8f0',
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669'
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626'
      }
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h5: {
        fontWeight: 700
      },
      h6: {
        fontWeight: 600
      },
      subtitle1: {
        fontWeight: 500
      },
      button: {
        textTransform: 'none',
        fontWeight: 600
      }
    },
    shape: {
      borderRadius: 10
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
            }
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      }
    }
  })
);

export const darkTheme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#6366f1', // Electric Indigo
        light: '#818cf8',
        dark: '#4f46e5',
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#38bdf8',
        light: '#7dd3fc',
        dark: '#0284c7'
      },
      background: {
        default: '#0b0f19', // Deep space slate
        paper: '#111827'   // Rich dark surface
      },
      text: {
        primary: '#f9fafb',
        secondary: '#9ca3af'
      },
      divider: '#1f2937',
      success: {
        main: '#34d399',
        light: '#6ee7b7',
        dark: '#059669'
      },
      error: {
        main: '#f87171',
        light: '#fca5a5',
        dark: '#dc2626'
      }
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h5: {
        fontWeight: 700
      },
      h6: {
        fontWeight: 600
      },
      subtitle1: {
        fontWeight: 500
      },
      button: {
        textTransform: 'none',
        fontWeight: 600
      }
    },
    shape: {
      borderRadius: 10
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      }
    }
  })
);

