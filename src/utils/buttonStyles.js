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
