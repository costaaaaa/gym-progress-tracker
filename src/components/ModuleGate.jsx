import { useState } from 'react';
import { Alert, Box, Button, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useModule } from '../hooks/useModule';
import { saveModules } from '../api/modules';
import ButtonSpinner from './ButtonSpinner';

// «Il modulo X non è attivo»: al posto di una pagina (o di una tab) di un modulo non attivo. I dati sono rimasti;
// «Attiva» salva e la destinazione richiesta compare subito. Mai un'attivazione automatica.
export const ModuleInactive = ({ module, heading = 'h1' }) => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const turnOn = async () => {
    setSaving(true);
    setFailed(false);
    const res = await saveModules({ [module]: true });
    if (res.ok) {
      updateUser({ modules: res.modules });
    } else {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, maxWidth: 560, mx: 'auto' }}>
      <Typography component={heading} variant="pageTitle" gutterBottom>
        {t('modules.inactive.title', { name: t(`modules.${module}.name`) })}
      </Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 2 }}>{t('modules.inactive.text')}</Typography>
      {failed && <Alert severity="error" sx={{ mb: 2 }}>{t('modules.inactive.turn_on_error')}</Alert>}
      <Box>
        <Button variant="contained" onClick={turnOn} disabled={saving} startIcon={saving ? <ButtonSpinner size={16} /> : null} sx={{ minHeight: 44, fontSize: 16 }}>
          {t('modules.turn_on')}
        </Button>
      </Box>
    </Card>
  );
};

// Mostra i figli solo se il modulo è attivo, altrimenti la pagina «non attivo»
const ModuleGate = ({ module, children }) => (useModule(module) ? children : <ModuleInactive module={module} />);

export default ModuleGate;
