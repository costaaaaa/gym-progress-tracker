import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { red, grey } from '@mui/material/colors';
import { GlobalStyles } from '@mui/material';

const ThemeModeContext = createContext();

export const useThemeMode = () => useContext(ThemeModeContext);

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || 'light';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleThemeMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#d50000',
            light: '#ff5131',
            dark: '#9b0000',
          },
          secondary: {
            main: mode === 'light' ? grey[900] : grey[300],
            light: mode === 'light' ? grey[700] : grey[500],
            dark: mode === 'light' ? grey[900] : grey[100],
          },
          background: {
            default: mode === 'light' ? '#f8f9fa' : '#0a0a0b',
            paper: mode === 'light' ? '#ffffff' : '#141416',
          },
          text: {
            primary: mode === 'light' ? '#1a1a1b' : '#ffffff',
            secondary: mode === 'light' ? '#4a4a4b' : '#a0a0a2',
          }
        },
        typography: {
          fontFamily: '"Lexend", "Inter", "Roboto", sans-serif',
          h1: { fontFamily: '"Lexend", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
          h2: { fontFamily: '"Lexend", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
          h3: { fontFamily: '"Lexend", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
          h4: { fontFamily: '"Lexend", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
          h5: { fontFamily: '"Lexend", sans-serif', fontWeight: 700 },
          h6: { fontFamily: '"Lexend", sans-serif', fontWeight: 700 },
          button: {
            fontFamily: '"Lexend", sans-serif',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'none',
          },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                transition: 'background-color 0.3s ease, color 0.3s ease',
              }
            }
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                background: mode === 'light' 
                  ? `linear-gradient(135deg, #d50000 0%, #9b0000 100%)`
                  : `linear-gradient(135deg, #141416 0%, #0a0a0b 100%)`,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                borderRadius: 0,
                borderBottom: mode === 'light' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                padding: '10px 24px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              containedPrimary: {
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(213, 0, 0, 0.4)',
                },
              },
              contained: {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundImage: 'none',
                boxShadow: mode === 'light' 
                  ? '0 4px 20px rgba(0, 0, 0, 0.03)'
                  : '0 4px 20px rgba(0, 0, 0, 0.4)',
                border: mode === 'light' ? '1px solid #f1f3f5' : '1px solid rgba(255, 255, 255, 0.05)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundImage: 'none',
                boxShadow: mode === 'light'
                  ? '0 4px 20px rgba(0, 0, 0, 0.03)'
                  : '0 4px 20px rgba(0, 0, 0, 0.4)',
                border: mode === 'light' ? '1px solid #f1f3f5' : '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: mode === 'light'
                    ? '0 12px 28px rgba(0, 0, 0, 0.08)'
                    : '0 12px 28px rgba(0, 0, 0, 0.6)',
                },
              },
            },
          },
          MuiBottomNavigation: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#141416',
                borderTop: mode === 'light' ? '1px solid #f1f3f5' : '1px solid rgba(255, 255, 255, 0.05)',
              }
            }
          },
          MuiBottomNavigationAction: {
            styleOverrides: {
              root: {
                color: mode === 'light' ? grey[600] : grey[500],
                '&.Mui-selected': {
                  color: '#d50000',
                }
              }
            }
          }
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      <GlobalStyles
        styles={{
          ':root': {
            '--primary-main': '#d50000',
            '--primary-light': '#ff5131',
            '--bg-overlay': mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.85)',
          },
        }}
      />
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

