import { useState } from 'react';
import { Alert, Box, Button, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useModule, useSaveModules } from '../hooks/useModule';
import ButtonSpinner from './ButtonSpinner';

// «Il modulo X non è attivo»: al posto di una pagina (o di una tab) di un modulo non attivo. I dati sono rimasti;
// «Attiva» salva e la destinazione richiesta compare subito. Mai un'attivazione automatica.
// `name` (già tradotto) è facoltativo: se manca vale il nome del modulo.
export const ModuleInactive = ({ module, name, heading = 'h1' }) => {
  const { t } = useTranslation();
  const save = useSaveModules();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const turnOn = async () => {
    setSaving(true);
    setFailed(false);
    const res = await save({ [module]: true });
    if (!res.ok) {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, maxWidth: 560, mx: 'auto' }}>
      <Typography component={heading} variant="pageTitle" gutterBottom>
        {t('modules.inactive.title', { name: name ?? t(`modules.${module}.name`) })}
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
const ModuleGate = ({ module, name, children }) => (useModule(module) ? children : <ModuleInactive module={module} name={name} />);

export default ModuleGate;
