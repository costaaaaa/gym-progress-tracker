import { useState } from 'react';
import { Paper, Typography, Button, Alert, Box, Link } from '@mui/material';
import { setConsent } from '../utils/consent';
import { useTranslation, Trans } from 'react-i18next';

// Mostrata al posto delle misure corporee finché l'utente non dà il consenso esplicito.
// Peso e misure sono dati sulla salute (art. 9 GDPR): il consenso è separato dai termini d'uso
// e si può revocare in qualsiasi momento da Profilo > Impostazioni.
// updated: l'utente l'aveva già dato per una versione precedente del testo.
const HealthConsentCard = ({ onGranted, updated = false }) => {
  const { t } = useTranslation();
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
        {t('health_consent.title')}
      </Typography>
      {updated && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('health_consent.updated')}
        </Alert>
      )}
      <Typography sx={{ mb: 2 }}>
        {t('health_consent.intro')}
      </Typography>
      <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 2, '& li': { mb: 0.75 } }}>
        <li>{t('health_consent.point_use')}</li>
        <li>{t('health_consent.point_private')}</li>
        <li>{t('health_consent.point_apps')}</li>
        <li>{t('health_consent.point_revoke')}</li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        <Trans
          i18nKey="health_consent.details"
          components={{ privacy: <Link href="/privacy.html" target="_blank" rel="noopener" /> }}
        />
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Button variant="contained" onClick={handleGrant} disabled={loading}>
        {t('health_consent.grant')}
      </Button>
    </Paper>
  );
};

export default HealthConsentCard;
