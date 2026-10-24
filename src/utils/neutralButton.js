// Bottone outlined neutro: inchiostro con bordo grigio visibile. Il rosso del marchio è solo dell'azione principale.
export const NEUTRAL_OUTLINED = {
  color: 'text.primary',
  borderColor: 'text.secondary',
  '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
};

// Bottone di testo neutro (azioni secondarie in una riga)
export const NEUTRAL_TEXT = {
  color: 'text.primary',
  '&:hover': { bgcolor: 'action.hover' },
};
