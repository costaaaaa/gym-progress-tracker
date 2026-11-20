import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useSaveModules } from '../../hooks/useModule';
import { hasFocusSessionInProgress } from '../../utils/focusDraft';
import { radius } from '../../theme/radius';

// Le tre scelte della schermata, con la chiave del modulo che attivano
const CHOICES = ['body', 'groups', 'levels'];
const TITLE_ID = 'interests-title';
const INTRO_ID = 'interests-intro';

// Montato una volta sola nel layout, fuori dalla pagina. «Cosa ti interessa?» compare da sola a un account nuovo
// (`modules_chosen === false`) dopo la conferma dell'email, e non torna: la scelta si rifà da Account > Moduli.
// Con `modules_chosen` assente (copia vecchia, server vecchio) vale «già scelto». Con un allenamento Focus in corso
// non compare: aspetta l'apertura successiva dell'app. Esc e il clic fuori non la chiudono: si esce solo con
// «Continua» e «Salta», così la scelta non si perde per sbaglio.
const InterestsGate = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { isLoggedIn, user, emailState } = useAuth();
  const save = useSaveModules();
  // null = non ancora deciso in questa apertura; 'show' = la schermata è dovuta; 'later' = rimandata (Focus in corso)
  const [turn, setTurn] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const due = Boolean(isLoggedIn && emailState?.verified && !emailState.blocked && user?.modules_chosen === false);

  // Si decide una volta sola, quando la schermata diventa dovuta
  useEffect(() => {
    if (due && turn === null) setTurn(hasFocusSessionInProgress() ? 'later' : 'show');
  }, [due, turn]);

  const open = due && turn === 'show';

  // Una sola chiamata: i moduli scelti (nessuno per «Salta») e la chiusura. Con un salvataggio in corso i pulsanti non rispondono.
  const send = async (patch) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const res = await save(patch, true);
    if (!res.ok) {
      setFailed(true);
      setBusy(false);
    }
  };
  const pickedPatch = () => Object.fromEntries(CHOICES.filter((key) => picked[key]).map((key) => [key, true]));

  return (
    <Dialog
      open={open}
      onClose={() => {}}
      disableEscapeKeyDown
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby={TITLE_ID}
      aria-describedby={INTRO_ID}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : radius.xxl } }}
    >
      <DialogTitle id={TITLE_ID} component="h2">{t('interests.title')}</DialogTitle>
      <DialogContent>
        <Typography id={INTRO_ID} sx={{ fontSize: 16, color: 'text.secondary', mb: 2 }}>{t('interests.intro')}</Typography>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
          {CHOICES.map((key, index) => {
            const checked = Boolean(picked[key]);
            return (
              <Box
                component="li"
                key={key}
                sx={{
                  border: '1px solid',
                  borderColor: checked ? 'text.primary' : 'divider',
                  borderWidth: checked ? 2 : 1,
                  borderRadius: radius.lg,
                  '&:focus-within': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
                }}
              >
                <Box component="label" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, minHeight: 44, cursor: 'pointer' }}>
                  <Checkbox
                    autoFocus={index === 0}
                    checked={checked}
                    onChange={(e) => setPicked((prev) => ({ ...prev, [key]: e.target.checked }))}
                    inputProps={{ 'aria-label': t(`interests.${key}.name`), 'aria-describedby': `interests-help-${key}` }}
                    sx={{ p: 0.5, mt: -0.25 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t(`interests.${key}.name`)}</Typography>
                    <Typography id={`interests-help-${key}`} sx={{ fontSize: 16, color: 'text.secondary' }}>{t(`interests.${key}.help`)}</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        {failed && <Alert severity="error" sx={{ mt: 2 }}>{t('interests.error')}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button type="button" onClick={() => send({})} aria-busy={busy} sx={{ minHeight: 44, fontSize: 16 }}>{t('interests.skip')}</Button>
        <Button type="button" variant="contained" onClick={() => send(pickedPatch())} aria-busy={busy} sx={{ minHeight: 44, fontSize: 16 }}>{t('interests.continue')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InterestsGate;
