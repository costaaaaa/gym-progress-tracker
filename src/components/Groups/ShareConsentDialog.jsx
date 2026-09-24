import { useState } from 'react';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, Typography,
} from '@mui/material';

// Consenso all'ingresso in un gruppo: cosa vedranno gli altri membri e cosa no.
// Senza la spunta il server rifiuta l'ingresso (join.php, code consent_required).
const ShareConsentDialog = ({ open, groupName, username, loading, onClose, onConfirm }) => {
  const [accepted, setAccepted] = useState(false);

  const close = () => {
    setAccepted(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700 }}>Entra in «{groupName}»</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Gli altri membri vedranno</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>il tuo username{username ? ` (${username})` : ''}</li>
          <li>livello, XP e streak</li>
          <li>allenamenti e volume (kg) della settimana</li>
        </Box>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Non vedranno</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>email, peso e misure corporee</li>
          <li>i dettagli degli allenamenti (esercizi, carichi, ripetizioni)</li>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
          Puoi uscire dal gruppo quando vuoi: i tuoi dati spariscono subito dalla classifica.{' '}
          <Link href="/privacy.html" target="_blank" rel="noopener">Informativa privacy</Link>
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
          label="Accetto che i membri del gruppo vedano questi dati"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={loading}>Annulla</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!accepted || loading}>
          Entra nel gruppo
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareConsentDialog;
