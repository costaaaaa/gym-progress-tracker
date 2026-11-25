// Rientro orizzontale interno di ogni bottone (lo scrive il tema): chi allinea il testo di un bottone al contenuto lo toglie.
export const BUTTON_PADDING_X = 18;

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

// Bottone di solo testo il cui testo, e non il suo bordo, sta in asse col contenuto: il margine negativo toglie il rientro
// interno da entrambi i lati (a sinistra, o a destra se il bottone è allineato a destra), l'area toccabile resta quella
// intera e di almeno 44 px. Va dato a un bottone che sta da solo sulla sua riga: due bottoni accanto si sovrapporrebbero.
export const ALIGN_TEXT = { mx: `-${BUTTON_PADDING_X}px`, minHeight: 44 };

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
