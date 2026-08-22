import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
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
            default: mode === 'light' ? '#f7f6f5' : '#0a0a0b',
            paper: mode === 'light' ? '#ffffff' : '#141416',
          },
          text: {
            primary: mode === 'light' ? '#1a1816' : '#ffffff',
            secondary: mode === 'light' ? '#6b6663' : '#a0a0a2',
          },
          divider: mode === 'light' ? '#ececea' : 'rgba(255, 255, 255, 0.08)',
          success: {
            main: mode === 'light' ? '#16a34a' : '#22c55e',
          },
          warning: {
            main: mode === 'light' ? '#d97706' : '#f59e0b',
          },
          error: {
            main: mode === 'light' ? '#d50000' : '#ff5252',
          },
          info: {
            main: mode === 'light' ? '#4f46e5' : '#818cf8',
          },
          // Token extra usato dal redesign per l'Indice di Progresso (non uno slot MUI standard)
          violet: {
            main: mode === 'light' ? '#7c3aed' : '#a78bfa',
            light: mode === 'light' ? '#a78bfa' : '#c4b5fd',
            dark: mode === 'light' ? '#5b21b6' : '#7c3aed',
            contrastText: '#ffffff',
          },
        },
        shape: {
          borderRadius: 16,
        },
        typography: {
          fontFamily: '"Inter", "Roboto", sans-serif',
          h1: { fontFamily: '"Lexend", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
          h2: { fontFamily: '"Lexend", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
          h3: { fontFamily: '"Lexend", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
          h4: { fontFamily: '"Lexend", sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
          h5: { fontFamily: '"Lexend", sans-serif', fontWeight: 700 },
          h6: { fontFamily: '"Lexend", sans-serif', fontWeight: 700 },
          button: {
            fontFamily: '"Inter", sans-serif',
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
                background: mode === 'light' ? '#ffffff' : '#141416',
                color: mode === 'light' ? '#1a1816' : '#ffffff',
                boxShadow: 'none',
                borderRadius: 0,
                borderBottom: mode === 'light' ? '1px solid #ececea' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                padding: '10px 18px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundImage: 'none',
                boxShadow: 'none',
                border: mode === 'light' ? '1px solid #ececea' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundImage: 'none',
                boxShadow: 'none',
                border: mode === 'light' ? '1px solid #ececea' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiBottomNavigation: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#141416',
                borderTop: mode === 'light' ? '1px solid #ececea' : '1px solid rgba(255, 255, 255, 0.08)',
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
          },
        }}
      />
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};
