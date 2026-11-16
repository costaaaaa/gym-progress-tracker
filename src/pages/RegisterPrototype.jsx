// PROTOTIPO USA E GETTA: comportamento del campo «Conferma password» per variante.
import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { visuallyHidden } from '@mui/utils';

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

// ---- Variante E «D gentile» ----------------------------------------------------------------------
const MATCH_E = 'Le password coincidono';
const HINT_E = 'Riscrivi la stessa password';
const PAUSE_MS = 600;

// Tutte le regole in un posto solo.
//   focused: 'confirm' | 'password' | false  = l'utente sta scrivendo in quel campo (false: ha finito / è uscito)
//   settled: true se è passata la pausa di 600 ms dall'ultimo tasto
// Ritorna 'idle' | 'typing' | 'match' | 'mismatch'.
export const confirmState = ({ password, confirm, focused, settled }) => {
  if (!confirm) return 'idle';
  if (confirm === password) return 'match';
  const finished = !focused || settled; // uscito dal campo, oppure fermo da 600 ms
  // Scrivendo nel campo conferma: lunga almeno quanto la password e diversa = errore certo, subito.
  if (focused === 'confirm' && confirm.length >= password.length) return 'mismatch';
  // Scrivendo nella prima password niente rosso a ogni tasto: solo a campo lasciato o dopo la pausa.
  if (!finished) return 'typing';
  if (password.startsWith(confirm)) return focused ? 'typing' : 'mismatch'; // giusta finora: rossa solo se esci dal campo
  return 'mismatch'; // carattere sbagliato, a pausa fatta o a campo lasciato
};

export const useConfirmE = (password, confirm) => {
  const [focused, setFocused] = useState(false);
  const [settled, setSettled] = useState(true);
  const [announce, setAnnounce] = useState('');
  const timer = useRef(null);
  const state = confirmState({ password, confirm, focused, settled });
  useEffect(() => () => clearTimeout(timer.current), []);
  // L'annuncio cambia solo quando si entra in match o mismatch (mai per il suggerimento grigio)
  const prev = useRef('idle');
  useEffect(() => {
    if (prev.current !== state) {
      if (state === 'match') setAnnounce(MATCH_E);
      else if (state === 'mismatch') setAnnounce(MISMATCH);
      else setAnnounce('');
    }
    prev.current = state;
  }, [state]);
  const typed = (field) => () => {
    setFocused(field);
    setSettled(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSettled(true), PAUSE_MS);
  };
  const finish = () => {
    clearTimeout(timer.current);
    setFocused(false);
    setSettled(true);
  };
  return { state, announce, typedPassword: typed('password'), typedConfirm: typed('confirm'), finish };
};

const ROW = { height: '1.66em', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' };

// Props del campo conferma per la variante E. requiredError: errore «Avanti» con campo vuoto.
export const confirmPropsE = (state, requiredError) => {
  // Fuori dall'errore il campo ha il bordo/etichetta in focus neutri (secondary): il rosso di primary in focus sembrerebbe un errore.
  const neutral = { color: 'secondary', sx: { '& .MuiInputLabel-root.Mui-focused:not(.Mui-error)': { color: 'text.primary' } } };
  if (state === 'mismatch') return { error: true, helperText: <Box component="span" sx={ROW}>{MISMATCH}</Box> };
  if (state === 'idle' && requiredError) {
    return { error: true, helperText: <Box component="span" sx={ROW}>{requiredError}</Box> };
  }
  if (state === 'match') {
    return {
      ...neutral,
      error: false,
      helperText: (
        <Box component="span" sx={ROW}>
          <CheckCircleOutlineIcon aria-hidden fontSize="inherit" sx={{ fontSize: '1.2em' }} />
          {MATCH_E}
        </Box>
      ),
      FormHelperTextProps: { sx: { color: 'success.main' } },
    };
  }
  return { ...neutral, error: false, helperText: <Box component="span" sx={ROW}>{HINT_E}</Box> };
};

export const liveRegionSx = visuallyHidden;
