import { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import { GlobalStyles } from '@mui/material';
import { itIT, enUS } from '@mui/material/locale';
import { useTranslation } from 'react-i18next';
import { CHIP_FONT, TITLE_FONT_FAMILY } from '../utils/fonts';
import { radius } from '../theme/radius';
import { FIELD_INPUT_PADDING_Y } from '../theme/fieldHeight';
import { BUTTON_PADDING_X } from '../utils/buttonStyles';

const BRAND = '#d50000';
const BRAND_DARK = '#9b0000';
const ERROR_ON_DARK = '#ff5252';
// Bordo dei campi a riposo: 3.5 : 1 sul bianco e 3.6 : 1 su #141416 (almeno 3 : 1 anche su #f7f6f5).
const FIELD_BORDER = { light: '#8c8885', dark: '#6e6e70' };
const WARNING = { light: '#d97706', dark: '#f59e0b' };
// Arancio come testo o icona: in chiaro WARNING dà 2.9 : 1 sul grigio di fondo (serve 4.5 : 1), questo arriva ad almeno
// 4.6 : 1 su bianco, fondo pagina, grigio e chip dei record; in scuro WARNING basta già.
const WARNING_TEXT = { light: '#a85007', dark: WARNING.dark };
const TEXT_PRIMARY = { light: '#1a1816', dark: '#ffffff' };
// Contorno del focus dentro la voce, per i contenitori che tagliano (scorrimento delle schede, menu, card)
const FOCUS_INSIDE = { '&.Mui-focusVisible': { outlineOffset: '-2px' } };
const PRIMARY_AS_TEXT = ({ theme }) => ({ color: theme.palette.primary.text });

const ThemeModeContext = createContext();

export const useThemeMode = () => useContext(ThemeModeContext);

const DARK_QUERY = '(prefers-color-scheme: dark)';
const systemQuery = () => window.matchMedia?.(DARK_QUERY);
// Senza matchMedia vale il chiaro
const systemIsDark = () => Boolean(systemQuery()?.matches);

export const ThemeModeProvider = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState(() => {
    // La scelta salvata ('light' o 'dark'); senza chiave, con un valore sconosciuto o con lo storage bloccato vale 'system'
    try {
      const saved = localStorage.getItem('themeMode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage bloccato: vale il sistema */ }
    return 'system';
  });
  const [systemDark, setSystemDark] = useState(systemIsDark);
  // Il tema in vigore: la scelta fissa o, con 'system', l'aspetto del sistema
  const mode = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference;

  // Con 'system' il tema segue il sistema anche a pagina aperta. Fuori da 'system' l'ascolto non c'è.
  useEffect(() => {
    if (themePreference !== 'system') return undefined;
    const query = systemQuery();
    if (!query) return undefined;
    const follow = () => setSystemDark(query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [themePreference]);

  // <html> segue il tema (come /tema.js prima di React): lo sfondo scuro di index.html non resta dopo il passaggio al chiaro.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  // Una scelta si salva nel gestore e non in un effetto, così il solo caricamento non scrive niente. 'system' toglie la
  // chiave: /tema.js, il blog e le pagine statiche, senza chiave, seguono il sistema. Tornando a 'system' l'aspetto del
  // sistema si rilegge qui, insieme alla scelta: può essere cambiato mentre la scelta era fissa e nessuno ascoltava.
  const setThemePreference = (next) => {
    setThemePreferenceState(next);
    if (next === 'system') setSystemDark(systemIsDark());
    try {
      if (next === 'system') localStorage.removeItem('themeMode');
      else localStorage.setItem('themeMode', next);
    } catch { /* vale solo per questa visita */ }
  };

  // Il bottone della barra: passa al tema opposto a quello in vigore e lo salva come scelta
  const toggleThemeMode = () => setThemePreference(mode === 'light' ? 'dark' : 'light');

  const { i18n } = useTranslation();
  const muiLocale = i18n.language === 'en' ? enUS : itIT;

  const theme = useMemo(
    () => {
      // Il rosso del marchio quando è un testo: lo usano il token primary.text, le voci selezionate del tema e il cursore di scrittura dei campi
      const primaryText = mode === 'light' ? BRAND : ERROR_ON_DARK;
      // Contorno del focus da tastiera: colore del testo del tema, staccato di 2px dal controllo
      const focusRing = {
        outline: `2px solid ${TEXT_PRIMARY[mode]}`,
        outlineOffset: '2px',
      };
      return createTheme({
        palette: {
          mode,
          primary: {
            main: BRAND,
            light: '#ff5131',
            dark: BRAND_DARK,
            // Rosso quando è il colore di un testo o di un'icona: in scuro il rosso del marchio
            // dà 3.35 : 1 su #141416 (serve 4.5 : 1), qui il rosso chiaro degli errori.
            text: primaryText,
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
            // Riga «tu» della classifica: in chiaro come action.selected di MUI; in scuro più tenue (0.12 invece
            // di 0.16) perché il testo secondario (#a0a0a2) arrivi a 4.8 : 1 (con 0.16 si ferma a 4.4 : 1).
            mine: mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)',
          },
          text: {
            primary: TEXT_PRIMARY[mode],
            secondary: mode === 'light' ? '#6b6663' : '#a0a0a2',
          },
          divider: mode === 'light' ? '#ececea' : 'rgba(255, 255, 255, 0.08)',
          success: {
            main: mode === 'light' ? '#15803d' : '#22c55e',
            // Testo sul verde pieno: bianco su #15803d è 5.0 : 1; su #22c55e il bianco darebbe 2.3 : 1, il quasi nero 8.7 : 1
            contrastText: mode === 'light' ? '#ffffff' : '#0a0a0b',
            // Pillola "scheda attiva" in WorkoutPlans
            muted: mode === 'light' ? '#e8f3ec' : 'rgba(34, 197, 94, 0.15)',
            title: mode === 'light' ? '#166534' : '#86efac',
          },
          warning: {
            main: WARNING[mode],
            text: WARNING_TEXT[mode],
            // Chip "nuovo record" in Focus: arancio proprio, non legato a warning.main
            muted: 'rgba(255, 167, 38, 0.15)',
          },
          error: {
            main: mode === 'light' ? BRAND : ERROR_ON_DARK,
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
          // Ventaglio del pulsante centrale: velo scuro sulla pagina (testo bianco sopra, 5.7 : 1 anche sul bianco);
          // tondi chiari in chiaro, scuri con un bordo sottile in scuro, per staccarli dal velo
          fan: {
            veil: 'rgba(0, 0, 0, 0.6)',
            item: mode === 'light' ? '#f2f2f2' : '#2e2e30',
            itemBorder: mode === 'light' ? 'transparent' : 'rgba(255, 255, 255, 0.22)',
          },
          // Avatar di navbar e account: inchiostro e testo sopra, come nell'app.
          // Bordo a riposo dei campi (3:1): lo usano anche i campi di Focus che ridisegnano il bordo con sx.
          fieldBorder: FIELD_BORDER[mode],
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
          // Sta sempre in un blocco alto almeno 44 px (come pulsanti e freccia) con il testo al centro: così il titolo ha la
          // stessa altezza in ogni pagina, con o senza pulsante o freccia sulla riga, anche quando il pulsante va a capo.
          pageTitle: {
            display: 'flex',
            alignItems: 'center',
            minHeight: 44,
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
          MuiCircularProgress: { defaultProps: { 'aria-label': i18n.t('common.loading') } },
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
          // con il padding verticale dell'input. Il multiline mette il padding sulla radice (non toccata
          // qui) e azzera quello della textarea: l'override di `input` si applicherebbe anche lì (stessa
          // classe), quindi lo si annulla con `inputMultiline`.
          MuiOutlinedInput: {
            defaultProps: {
              notched: false,
            },
            styleOverrides: {
              root: {
                borderRadius: radius.md,
                // MUI, sul tocco, rimette il bordo chiaro di default quando il campo ha l'hover: qui resta il bordo del tema
                '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
                  '@media (hover: none)': { borderColor: FIELD_BORDER[mode] },
                },
                // Campo attivo neutro: il rosso del marchio è uguale a quello dell'errore, quindi a fuoco il bordo
                // ha il colore del testo; in errore resta quello dell'errore (la guardia :not(.Mui-error)).
                '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: TEXT_PRIMARY[mode] },
              },
              input: {
                // Il cursore di scrittura tiene il rosso del marchio, anche in errore
                caretColor: primaryText,
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
                borderColor: FIELD_BORDER[mode],
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
              },
              'a:focus-visible': focusRing,
              // Solo i <button> non MUI: quelli MUI hanno già il contorno con .Mui-focusVisible (e FOCUS_INSIDE dove serve)
              'button:not(.MuiButtonBase-root):focus-visible': focusRing,
            }
          },
          // Etichetta a fuoco: colore del testo principale, come il bordo. In errore resta il colore dell'errore (la guardia :not(.Mui-error)).
          MuiFormLabel: {
            styleOverrides: {
              root: {
                '&.Mui-focused:not(.Mui-error)': { color: TEXT_PRIMARY[mode] },
              },
            },
          },
          // Focus da tastiera su ogni controllo basato su ButtonBase (bottoni, icone, chip, voci di menu e di
          // lista, schede, link di navigazione): solo con :focus-visible, mouse e tocco non vedono nulla.
          MuiButtonBase: {
            styleOverrides: {
              root: { '&.Mui-focusVisible': focusRing },
            },
          },
          // Nei contenitori che tagliano (scorrimento delle schede, menu): il contorno resta dentro la voce
          MuiTab: { styleOverrides: { root: FOCUS_INSIDE } },
          MuiMenuItem: { styleOverrides: { root: FOCUS_INSIDE } },
          MuiListItemButton: { styleOverrides: { root: FOCUS_INSIDE } },
          // Il cursore dello slider è un <span> con l'input dentro: il contorno va sul cursore
          MuiSlider: { styleOverrides: { thumb: { '&.Mui-focusVisible': focusRing } } },
          MuiCardActionArea: { styleOverrides: { root: FOCUS_INSIDE } },
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
          MuiSwitch: { defaultProps: { color: 'success' }, styleOverrides: { switchBase: FOCUS_INSIDE } },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: radius.md,
                padding: `10px ${BUTTON_PADDING_X}px`,
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
              // Bottoni di testo e con bordo: l'etichetta è un testo, quindi primary.text
              textPrimary: PRIMARY_AS_TEXT,
              outlinedPrimary: PRIMARY_AS_TEXT,
            },
          },
          MuiIconButton: { styleOverrides: { colorPrimary: PRIMARY_AS_TEXT } },
          // Ogni Chip con onClick: due classi, quindi vince su fontFamily e fontWeight dati con sx
          MuiChip: {
            styleOverrides: {
              root: {
                '&.MuiChip-clickable': CHIP_FONT,
              },
              outlinedPrimary: PRIMARY_AS_TEXT,
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
                '&.Mui-focusVisible': focusRing,
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
          // Piede di ogni finestra: stesso margine laterale del contenuto (24 px) e 16 px sotto
          MuiDialogActions: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
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
                  color: primaryText,
                }
              }
            }
          }
        },
      }, muiLocale);
    },
    [mode, muiLocale, i18n]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, themePreference, setThemePreference, toggleThemeMode }}>
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
