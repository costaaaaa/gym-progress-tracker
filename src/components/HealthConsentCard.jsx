import { useState } from 'react';
import { Paper, Typography, Button, Alert, Box, Link } from '@mui/material';
import { setConsent } from '../utils/consent';

// Mostrata al posto delle misure corporee finché l'utente non dà il consenso esplicito.
// Peso e misure sono dati sulla salute (art. 9 GDPR): il consenso è separato dai termini d'uso
// e si può revocare in qualsiasi momento da Profilo > Impostazioni.
const HealthConsentCard = ({ onGranted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGrant = async () => {
    setLoading(true);
    setError('');
    try {
      await setConsent('health_data', 'grant');
      onGranted();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, maxWidth: 640, mx: 'auto', mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Le misure corporee sono dati sulla salute
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Per tenere traccia di peso, massa grassa e circonferenze ho bisogno del tuo consenso esplicito.
      </Typography>
      <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 2, '& li': { mb: 0.75 } }}>
        <li>Li uso solo per mostrarti i tuoi grafici e l&apos;andamento nel tempo.</li>
        <li>Non sono visibili ad altri utenti.</li>
        <li>Puoi revocare il consenso quando vuoi da Profilo &gt; Impostazioni: in quel caso le misure vengono cancellate.</li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Maggiori dettagli nell&apos;{' '}
        <Link href="/privacy.html" target="_blank" rel="noopener">informativa privacy</Link>.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Button variant="contained" onClick={handleGrant} disabled={loading}>
        Acconsento al trattamento delle misure corporee
      </Button>
    </Paper>
  );
};

export default HealthConsentCard;
