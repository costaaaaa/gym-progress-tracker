// Regole della forma B+ per le sole schermate di accesso (login, registrazione, password
// dimenticata, reset password). Un solo posto: AuthLayout le applica con un ThemeProvider
// annidato, così le pagine non cambiano campo per campo.
//
// MuiInputLabel e MuiOutlinedInput: queste chiavi andranno pari pari nel tema principale con la
// prossima PR (etichetta sopra e campo 10/44 per tutti i form), quindi restano scritte come se
// vivessero già lì (nessun riferimento ad "auth" nei valori).
//
// I DatePicker di Register (@mui/x-date-pickers) non hanno `enableAccessibleFieldDOMStructure`
// impostato: usano quindi ancora il TextField/OutlinedInput "classico" (non i componenti propri
// MuiPickersOutlinedInput/MuiPickersInputBase delle versioni più recenti), e sono già coperti dagli
// override qui sotto senza bisogno di chiavi dedicate.
import { radius } from './radius';

export const authControlsOverrides = {
  // Etichetta fissa sopra il campo, in flusso normale: niente più posizione assoluta né la
  // transform che la fa salire nel bordo. Lo shrink resta sempre true (etichetta piccola, mai
  // dentro il campo). Colore (testo secondario, focus, errore) resta quello di MuiFormLabel: qui
  // non lo ridefiniamo, altrimenti vincerebbe sulla regola di focus/errore che ha più specificità.
  MuiInputLabel: {
    defaultProps: {
      shrink: true,
    },
    styleOverrides: {
      root: {
        position: 'static',
        transform: 'none',
        // Non più sovrapposta al campo: il clic sul testo deve tornare a portare il focus sul campo.
        pointerEvents: 'auto',
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: 600,
      },
    },
  },
  // Niente tacca nel bordo per l'etichetta (non serve più: sta sopra, non dentro il bordo) e
  // campo alto 44: il testo dell'input in MUI è alto 23px, il padding verticale lo porta a 44.
  MuiOutlinedInput: {
    defaultProps: {
      notched: false,
    },
    styleOverrides: {
      root: {
        borderRadius: radius.md,
      },
      notchedOutline: {
        '& legend': { display: 'none' },
      },
      input: {
        paddingTop: '10.5px',
        paddingBottom: '10.5px',
      },
    },
  },
  // Bottoni dell'accesso: a pillola, alti 44 indipendentemente da size/variant (l'altezza fissa
  // non tocca il padding, il contenuto resta centrato). Restano solo qui: non seguono i campi nel
  // tema principale.
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: radius.pill,
        height: '44px',
      },
    },
  },
};
