// PROTOTIPO USA E GETTA: comportamento del campo «Conferma password» per variante.
const MISMATCH = 'Le password non corrispondono';
const MATCH = 'Le password corrispondono';

export const confirmHelper = (variant, password, confirm, serverError) => {
  if (variant === 'B') return { error: Boolean(serverError), helperText: serverError || ' ' };
  if (variant === 'D') {
    if (!confirm) return { error: Boolean(serverError), helperText: serverError || ' ' };
    if (confirm === password) return { error: false, helperText: MATCH, FormHelperTextProps: { sx: { color: 'success.main' } } };
    if (password.startsWith(confirm)) return { error: false, helperText: ' ' }; // sta ancora scrivendo giusto
    return { error: true, helperText: MISMATCH };
  }
  return { error: Boolean(serverError), helperText: serverError }; // A e C
};
