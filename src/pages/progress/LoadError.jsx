import { Alert, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Lettura fallita nelle pagine dei Progressi (tab Esercizi, Volume, Corpo e pagina dell'esercizio): l'errore nella pagina e «Riprova», che rilegge.
// Distinto dal «non c'è niente» di ogni tab.
const LoadError = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <Alert severity="error" sx={{ fontSize: 16 }} action={<Button color="inherit" onClick={onRetry} sx={{ minHeight: 44, fontSize: 16, fontWeight: 600 }}>{t('progress.retry')}</Button>}>
      {message}
    </Alert>
  );
};

export default LoadError;
