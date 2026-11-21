import { useRef, useState } from 'react';
import { Box, Button, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useSaveModules } from '../../hooks/useModule';
import { LABEL, DISABLED, DASHED_CARD, HOME_BUTTON } from './labelStyle';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// La proposta di un modulo non attivo (`moduleKey`, quello che il server propone adesso). «Attiva» e «No, grazie»
// rispondono al server (stesso punto di salvataggio dei moduli): a risposta data l'account cambia e la card sparisce da
// sola. Se la risposta non passa (rete, o la proposta nel frattempo è cambiata) `onError()` avvisa, la card resta e
// l'account si rilegge. Durante la richiesta i bottoni sono disabilitati (ma restano raggiungibili col fuoco).
const ModuleOffer = ({ moduleKey, onError }) => {
  const { t } = useTranslation();
  const { refreshEmailState } = useAuth();
  const save = useSaveModules();
  const [busy, setBusy] = useState(false);
  // Il ref regge anche a due eventi nello stesso giro, prima che lo stato si aggiorni
  const sending = useRef(false);
  const name = t(`modules.${moduleKey}.name`);

  const answer = async (accepted) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    const res = await save({}, { offerAnswer: { key: moduleKey, accepted } });
    if (!res.ok) {
      onError();
      refreshEmailState();
    }
    sending.current = false;
    setBusy(false);
  };

  return (
    <Card sx={{ ...DASHED_CARD, p: 2.5 }}>
      <Typography sx={{ ...LABEL, color: 'text.secondary', mb: 0.5 }}>{t('home.offer.label')}</Typography>
      <Typography component="h2" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: 16 }}>{name}</Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>{t(`modules.${moduleKey}.help`)}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
        <Button variant="contained" aria-label={t('home.offer.activate_aria', { name })} aria-disabled={busy ? 'true' : undefined} onClick={() => answer(true)} sx={{ ...HOME_BUTTON, ...DISABLED }}>
          {t('home.offer.activate')}
        </Button>
        <Button aria-label={t('home.offer.decline_aria', { name })} aria-disabled={busy ? 'true' : undefined} onClick={() => answer(false)} sx={{ ...HOME_BUTTON, ...DISABLED }}>
          {t('home.offer.decline')}
        </Button>
      </Box>
    </Card>
  );
};

export default ModuleOffer;
