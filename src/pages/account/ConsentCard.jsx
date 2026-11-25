import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
} from '@mui/material';
import Switch from '@mui/material/Switch';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation, Trans } from 'react-i18next';
import { legalPaths } from '../../i18n/paths';
import { getConsents, setConsent } from '../../utils/consent';
import ButtonSpinner from '../../components/ButtonSpinner';
import useDataExport from '../../hooks/useDataExport';

// Consenso per le misure corporee (dati sulla salute): concessione e revoca. La revoca cancella le misure, quindi chiede
// conferma in una finestra e propone prima l'export (`username` dà il nome al file).
const ConsentCard = ({ username, notify }) => {
  const { t, i18n } = useTranslation();
  const { exporting: exportLoading, download: handleDownloadData } = useDataExport(username, notify);
  const [healthConsent, setHealthConsent] = useState(null); // null = non ancora caricato
  const [consentBusy, setConsentBusy] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  // Consenso dato a una versione precedente del testo: va riconfermato
  const [healthConsentOutdated, setHealthConsentOutdated] = useState(false);

  useEffect(() => {
    getConsents()
      .then((consents) => {
        setHealthConsent(consents.health_data.granted);
        setHealthConsentOutdated(!consents.health_data.granted && consents.health_data.version !== null);
      })
      .catch((error) => console.error('Errore nel caricamento dei consensi:', error));
  }, []);

  const handleHealthConsentToggle = async (checked) => {
    if (!checked) {
      setRevokeDialogOpen(true);
      return;
    }
    setConsentBusy(true);
    try {
      await setConsent('health_data', 'grant');
      setHealthConsent(true);
      setHealthConsentOutdated(false);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setConsentBusy(false);
    }
  };

  const handleConfirmRevoke = async () => {
    setConsentBusy(true);
    try {
      const result = await setConsent('health_data', 'revoke');
      setHealthConsent(false);
      setHealthConsentOutdated(false);
      setRevokeDialogOpen(false);
      notify(
        result.deleted_stats > 0
          ? t('account.consent.revoked_deleted')
          : t('account.consent.revoked'),
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setConsentBusy(false);
    }
  };

  return (
    <>
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="cardTitle">{t('account.consent.title')}</Typography>
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 58, minHeight: 44 }}>
            <Switch
              checked={healthConsent === true}
              disabled={healthConsent === null || consentBusy}
              onChange={(e) => handleHealthConsentToggle(e.target.checked)}
              inputProps={{ 'aria-label': t('account.consent.aria') }}
            />
          </Box>
        </Box>
        <Box sx={{ maxWidth: 520 }}>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
            {t('account.consent.help')}
          </Typography>
          {healthConsentOutdated && healthConsent !== true && (
            <Typography sx={{ fontSize: 16, color: 'warning.text', mt: 0.5 }}>
              {t('account.consent.outdated')}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 16, mt: 1.5 }}>
          <Link href={legalPaths(i18n.language).privacy} target="_blank" rel="noopener noreferrer">{t('account.privacy')}</Link>
          {' · '}
          <Link href={legalPaths(i18n.language).terms} target="_blank" rel="noopener noreferrer">{t('account.terms')}</Link>
        </Typography>
      </Card>

      <Dialog open={revokeDialogOpen} onClose={() => !consentBusy && setRevokeDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('account.revoke.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, color: 'text.primary' }}>
            <Trans i18nKey="account.revoke.body" components={{ strong: <strong /> }} />
          </DialogContentText>
          <Button
            variant="outlined"
            startIcon={exportLoading ? <ButtonSpinner size={16} /> : <DownloadIcon />}
            onClick={handleDownloadData}
            disabled={exportLoading || consentBusy}
            sx={{ fontSize: 16 }}
          >
            {t('account.revoke.export_first')}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevokeDialogOpen(false)} disabled={consentBusy} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmRevoke} color="error" variant="contained" disabled={consentBusy} sx={{ fontSize: 16 }}>
            {t('account.revoke.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConsentCard;
