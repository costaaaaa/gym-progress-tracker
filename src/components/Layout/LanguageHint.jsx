import { useState } from 'react';
import { Alert, Link } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { browserLocale } from '../../i18n';
import { isEnPath, stripLangPrefix, withLangPrefix } from '../../i18n/paths';

const DISMISS_KEY = 'lx_lang_hint_dismissed';

// Nessun redirect automatico in base al browser (Google vedrebbe la home italiana in inglese):
// solo un avviso, scritto nella lingua proposta.
const LanguageHint = () => {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const pageLang = isEnPath(pathname) ? 'en' : 'it';
  const preferred = browserLocale();
  if (dismissed || !preferred || preferred === pageLang) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <Alert severity="info" onClose={dismiss} closeText={t('lang_hint.close', { lng: preferred })} sx={{ mb: 3 }}>
      {t('lang_hint.text', { lng: preferred })}{' '}
      <Link component={RouterLink} to={withLangPrefix(stripLangPrefix(pathname), preferred) + search} onClick={dismiss}>
        {t('lang_hint.link', { lng: preferred })}
      </Link>
    </Alert>
  );
};

export default LanguageHint;
