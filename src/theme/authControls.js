// Regole dei campi outlined nella forma B+: etichetta fissa sopra, raggio 10, alti 44, bordo senza tacca.
// AuthLayout le applica alle schermate di accesso (login, registrazione, password dimenticata, reset
// password) con un ThemeProvider annidato, così le pagine non cambiano campo per campo.
//
// I DatePicker di Register (@mui/x-date-pickers) non impostano `enableAccessibleFieldDOMStructure`:
// usano il TextField/OutlinedInput classico, quindi li coprono gli stessi override, senza chiavi
// MuiPickers* dedicate.
import { radius } from './radius';

export const authControlsOverrides = {
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
  // Bordo senza tacca per l'etichetta (sta sopra, non dentro il bordo) e campo alto 44: il testo
  // dell'input in MUI è alto 23px, il padding verticale lo porta a 44.
  MuiOutlinedInput: {
    defaultProps: {
      notched: false,
    },
    styleOverrides: {
      root: {
        borderRadius: radius.md,
      },
      input: {
        paddingTop: '10.5px',
        paddingBottom: '10.5px',
      },
    },
  },
};
