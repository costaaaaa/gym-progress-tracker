// Bottone outlined neutro: inchiostro con bordo grigio visibile. Il rosso del marchio è solo dell'azione principale.
export const NEUTRAL_OUTLINED = {
  color: 'text.primary',
  fontSize: 16,
  borderColor: 'text.secondary',
  '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
};

// Bottone di testo neutro (azioni secondarie in una riga)
export const NEUTRAL_TEXT = {
  color: 'text.primary',
  fontSize: 16,
  '&:hover': { bgcolor: 'action.hover' },
};
