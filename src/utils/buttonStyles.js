import { BUTTON_PADDING_X } from '../theme/buttonPadding';
import { PAGE_TITLE_BLOCK_HEIGHT } from '../theme/pageTitle';

const TEXT_BUTTON = {
  fontSize: 16,
  '&:hover': { bgcolor: 'action.hover' },
};

// Bottone outlined neutro: inchiostro con bordo grigio visibile. Il rosso pieno resta all'azione principale e a quelle che non si annullano.
export const NEUTRAL_OUTLINED = {
  color: 'text.primary',
  fontSize: 16,
  borderColor: 'text.secondary',
  '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
};

// Bottone di testo neutro (azioni secondarie in una riga)
export const NEUTRAL_TEXT = {
  ...TEXT_BUTTON,
  color: 'text.primary',
};

// Bottone di testo a filo del contenuto: il suo testo, e non il suo bordo, sta in asse col contenuto. Il margine negativo
// toglie il rientro interno solo dal lato `side` ('left', oppure 'right' per un bottone allineato a destra); l'altro lato non
// si tocca, così l'area toccabile resta intera (almeno 44 px) e non si sovrappone a quella di un bottone accanto.
export const flushTextButton = (side) => ({ minHeight: 44, [side === 'right' ? 'mr' : 'ml']: `-${BUTTON_PADDING_X}px` });

// Riga di azioni in fondo a una card o a una pagina: con due bottoni, da sm in su stanno accanto (il secondo a destra) e
// sotto sm uno per riga, a sinistra. Con un bottone solo, quello resta a sinistra a ogni larghezza.
export const ACTIONS_ROW = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { xs: 'flex-start', sm: 'stretch' },
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 1,
};

// Il bottone di testo che in una ACTIONS_ROW viene per secondo: a filo a sinistra sotto sm (sta sulla sua riga), a filo a
// destra da sm (sta accanto al primo). Se nella riga è l'unico bottone va usato flushTextButton('left').
export const flushTextButtonInActionsRow = (theme) => ({
  ...flushTextButton('left'),
  [theme.breakpoints.up('sm')]: { ml: 0, ...flushTextButton('right') },
});

// Bottone sulla riga del titolo di pagina: alto quanto il blocco del titolo, così la riga non cresce e il titolo resta alla
// stessa altezza delle pagine senza pulsante.
export const TITLE_ROW_BUTTON = { height: PAGE_TITLE_BLOCK_HEIGHT };

// Comando in forma di link sottolineato (es. «Scrivi il codice»): senza rientro, allineato al testo che lo precede
export const LINK_BUTTON = {
  minHeight: 44,
  minWidth: 44,
  px: 0,
  justifyContent: 'flex-start',
  fontSize: 16,
  fontWeight: 600,
  color: 'text.primary',
  textDecoration: 'underline',
  '&:hover': { textDecoration: 'underline', bgcolor: 'transparent' },
};

// Bottone di testo per un'azione che non si annulla: rosso, come nell'app
export const DANGER_TEXT = {
  ...TEXT_BUTTON,
  color: 'error.main',
  fontWeight: 700,
};

// Collegamento di testo con bersaglio da almeno 44 px, in inchiostro (es. «Cosa mostro»)
export const INK_LINK = {
  display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 16, fontWeight: 600, color: 'text.primary',
};
