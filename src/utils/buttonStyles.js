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

// Bottone di testo per un'azione che non si annulla: rosso, come nell'app
export const DANGER_TEXT = {
  ...TEXT_BUTTON,
  color: 'error.main',
  fontWeight: 700,
};
