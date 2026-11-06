import { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import { GlobalStyles } from '@mui/material';
import { itIT, enUS } from '@mui/material/locale';
import { useTranslation } from 'react-i18next';
import { CHIP_FONT, TITLE_FONT_FAMILY } from '../utils/fonts';
import { radius } from '../theme/radius';
import { FIELD_INPUT_PADDING_Y } from '../theme/fieldHeight';

const BRAND = '#d50000';
const BRAND_DARK = '#9b0000';
const ERROR_ON_DARK = '#ff5252';

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

  const { i18n } = useTranslation();
  const muiLocale = i18n.language === 'en' ? enUS : itIT;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: BRAND,
            light: '#ff5131',
            dark: BRAND_DARK,
          },
          secondary: {
            main: mode === 'light' ? grey[900] : grey[300],
            light: mode === 'light' ? grey[700] : grey[500],
            dark: mode === 'light' ? grey[900] : grey[100],
          },
          background: {
            default: mode === 'light' ? '#f7f6f5' : '#0a0a0b',
            paper: mode === 'light' ? '#ffffff' : '#141416',
            // Fondo neutro di una riga/card secondaria (storico, giorni di una scheda): in scuro è
            // lo stesso valore di action.hover di MUI (qui letterale per non dipendere da quello).
            subtle: mode === 'light' ? '#faf9f8' : 'rgba(255, 255, 255, 0.08)',
          },
          text: {
            primary: mode === 'light' ? '#1a1816' : '#ffffff',
            secondary: mode === 'light' ? '#6b6663' : '#a0a0a2',
          },
          divider: mode === 'light' ? '#ececea' : 'rgba(255, 255, 255, 0.08)',
          success: {
            main: mode === 'light' ? '#15803d' : '#22c55e',
            // Pillola "scheda attiva" in WorkoutPlans
            muted: mode === 'light' ? '#e8f3ec' : 'rgba(34, 197, 94, 0.15)',
            title: mode === 'light' ? '#166534' : '#86efac',
          },
          warning: {
            main: mode === 'light' ? '#d97706' : '#f59e0b',
            // Chip "nuovo record" in Focus: arancio proprio, non legato a warning.main
            muted: 'rgba(255, 167, 38, 0.15)',
          },
          // muted/border/title: la card "Zona pericolosa" (rosa, bordo rosa, titolo rosso scuro come nell'app).
          // In scuro: fondo e bordo sono il rosso di error.main trasparente, che sostituisce il fondo della card e
          // quindi sta sullo sfondo pagina (#0a0a0b): il titolo ha 9.2 : 1, il testo secondario 6.9 : 1.
          error: {
            main: mode === 'light' ? BRAND : ERROR_ON_DARK,
            muted: mode === 'light' ? '#fdecec' : alpha(ERROR_ON_DARK, 0.1),
            border: mode === 'light' ? '#f5c6c6' : alpha(ERROR_ON_DARK, 0.35),
            title: mode === 'light' ? BRAND_DARK : '#ff9e9e',
          },
          info: {
            main: mode === 'light' ? '#4f46e5' : '#818cf8',
          },
          // Stato di recupero muscolare: il rosso del marchio non è più uno stato. Tre luminosità
          // diverse (in chiaro 5.0 / 5.0 / 9.4 : 1 sul bianco), così le righe si distinguono anche in scala di grigi.
          recovery: {
            ready: mode === 'light' ? '#15803d' : '#22c55e',
            recovering: mode === 'light' ? '#b45309' : '#fbbf24',
            fatigued: mode === 'light' ? '#7c2d12' : '#f97316',
          },
          // Sezione a campo pieno della home (scena Focus): fondo quasi nero; in scuro un grigio più chiaro della pagina.
          scene: {
            bg: mode === 'light' ? '#141416' : '#222226',
            text: '#f7f6f5',
            muted: 'rgba(247, 246, 245, 0.72)',
          },
          // Token extra usato dal redesign per l'Indice di Progresso (non uno slot MUI standard)
          violet: {
            main: mode === 'light' ? '#7c3aed' : '#a78bfa',
            light: mode === 'light' ? '#a78bfa' : '#c4b5fd',
            dark: mode === 'light' ? '#5b21b6' : '#7c3aed',
            contrastText: '#ffffff',
          },
          // Medaglie della classifica di gruppo: uguali in chiaro e in scuro
          medal: {
            gold: '#d4a017',
            silver: '#9e9e9e',
            bronze: '#b87333',
          },
          // Integrazione con l'app Salute (BodyStats, promemoria di collegamento): uguale in chiaro e in scuro
          health: '#ff2d55',
          // Bottone del tema in Navbar: fondo neutro discreto, più marcato al passaggio del mouse
          navToggle: {
            bg: mode === 'light' ? '#f7f6f5' : 'rgba(255, 255, 255, 0.06)',
            hover: mode === 'light' ? '#ececea' : 'rgba(255, 255, 255, 0.12)',
          },
          // Avatar di navbar e account: inchiostro e testo sopra, come nell'app.
          ink: mode === 'light' ? '#1a1816' : '#ffffff',
          onInk: mode === 'light' ? '#ffffff' : '#0a0a0b',
        },
        shape: {
          borderRadius: 16,
        },
        typography: {
          fontFamily: '"Inter", "Roboto", sans-serif',
          h1: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, letterSpacing: '-0.02em' },
          h2: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, letterSpacing: '-0.02em' },
          h3: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, letterSpacing: '-0.01em' },
          h4: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, letterSpacing: '-0.01em' },
          h5: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 },
          h6: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 },
          // Titolo di una card o di una sezione. Interlinea come body1 (1.5): è il Typography senza variante
          // che sostituisce, con un tag <p> (vedi variantMapping sotto).
          cardTitle: { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: '17px', lineHeight: 1.5 },
          // Titolo di pagina: 28px a tutte le larghezze (nelle schermate di lavoro il titolo sta tra 24 e 32px). Interlinea come h1.
          pageTitle: {
            fontFamily: TITLE_FONT_FAMILY,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            fontSize: '28px',
            lineHeight: 1.167,
          },
          // Numero grande (riepiloghi, 1RM, peso attuale, statistiche): cifre tabulari, così non ballano.
          statNumber: {
            fontFamily: TITLE_FONT_FAMILY,
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          },
          button: {
            fontFamily: '"Inter", sans-serif',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'none',
          },
        },
        components: {
          // Etichetta fissa sopra il campo, in flusso normale: niente posizione assoluta né la transform
          // che la porta dentro il bordo. Lo shrink è sempre true (etichetta mai dentro il campo). Il
          // colore (testo secondario, focus, errore) resta quello di MuiFormLabel: ridefinirlo qui
          // vincerebbe sulle regole di focus ed errore.
          MuiInputLabel: {
            defaultProps: {
              shrink: true,
            },
            styleOverrides: {
              root: {
                position: 'static',
                transform: 'none',
                // Senza la scala 0.75 l'etichetta è larga quanto il suo testo: non oltre il campo
                maxWidth: '100%',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 600,
              },
            },
          },
          // Bordo senza tacca per l'etichetta (sta sopra, non dentro il bordo) e campo alto FIELD_HEIGHT
          // (44) con il padding verticale dell'input. Il multiline mette il
          // padding sulla radice (non toccata qui) e azzera quello della textarea: l'override di `input`
          // si applicherebbe anche lì (stessa classe), quindi lo si annulla con `inputMultiline`.
          MuiOutlinedInput: {
            defaultProps: {
              notched: false,
            },
            styleOverrides: {
              root: {
                borderRadius: radius.md,
              },
              input: {
                paddingTop: FIELD_INPUT_PADDING_Y,
                paddingBottom: FIELD_INPUT_PADDING_Y,
              },
              inputMultiline: {
                paddingTop: 0,
                paddingBottom: 0,
              },
              // Con displayEmpty (sotto) il Select outlined impone notched=true qualunque sia il valore:
              // solo il CSS può chiudere la tacca, qui, come per ogni altro campo.
              notchedOutline: {
                '& legend': { maxWidth: '0.01px' },
              },
            },
          },
          // Con l'etichetta sopra un Select senza valore mostrerebbe un riquadro vuoto: displayEmpty lo
          // evita quando il menu ha già una voce vuota (value ''), che allora si vede. La voce vuota va
          // scritta in <em>: è quella che il tema colora come un placeholder, non come un valore scelto.
          MuiSelect: {
            defaultProps: {
              displayEmpty: true,
            },
            styleOverrides: {
              select: ({ theme }) => ({
                '& em': {
                  color: theme.palette.text.secondary,
                },
              }),
            },
          },
          // L'Autocomplete dà il proprio padding all'OutlinedInput (radice e input) con selettori a 2 e 3
          // classi, più specifici dell'override `input` di MuiOutlinedInput: per l'altezza dei campi
          // servono gli stessi selettori annidati in `root`. La size="small" ha una regola sua, qui non
          // coperta.
          MuiAutocomplete: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  paddingTop: 0,
                  paddingBottom: 0,
                },
                '& .MuiOutlinedInput-root .MuiAutocomplete-input': {
                  paddingTop: FIELD_INPUT_PADDING_Y,
                  paddingBottom: FIELD_INPUT_PADDING_Y,
                },
              },
            },
          },
          // Una variante sconosciuta uscirebbe <span> (in linea, senza margini verticali): cardTitle è un <p>.
          MuiTypography: {
            defaultProps: {
              variantMapping: { cardTitle: 'p', pageTitle: 'h1', statNumber: 'p' },
            },
          },
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
          // Interruttori mai nel rosso del marchio: acceso = verde semantico
          MuiSwitch: { defaultProps: { color: 'success' } },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: radius.md,
                padding: '10px 18px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
              // In scuro i bottoni pieni di errore sono rosso del marchio con testo bianco (5.5 : 1), come i primari:
              // il bianco su error.main scuro (#ff5252) si ferma a 3.2 : 1.
              ...(mode === 'dark' && {
                containedError: {
                  backgroundColor: BRAND,
                  color: '#ffffff',
                  // MUI rimette palette.main sul tocco (hover: none): senza il reset il bottone resterebbe scuro dopo il tap
                  '&:hover': { backgroundColor: BRAND_DARK, '@media (hover: none)': { backgroundColor: BRAND } },
                },
              }),
            },
          },
          // Ogni Chip con onClick: due classi, quindi vince su fontFamily e fontWeight dati con sx
          MuiChip: {
            styleOverrides: {
              root: {
                '&.MuiChip-clickable': CHIP_FONT,
              },
            },
          },
          // Link nel testo: colore del testo e sottolineati (il rosso resta ai bottoni principali, agli errori e agli stati)
          MuiLink: {
            defaultProps: {
              color: 'text.primary',
              underline: 'always',
            },
            styleOverrides: {
              root: {
                '&:hover': { textDecorationColor: 'inherit' },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: radius.xxl,
                backgroundImage: 'none',
                boxShadow: 'none',
                border: mode === 'light' ? '1px solid #ececea' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: radius.xxl,
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
                  color: BRAND,
                }
              }
            }
          }
        },
      }, muiLocale),
    [mode, muiLocale]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      <GlobalStyles
        styles={{
          ':root': {
            '--primary-main': BRAND,
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
