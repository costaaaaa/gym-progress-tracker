import { Box, Button, Typography } from '@mui/material';
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { NEUTRAL_OUTLINED, LINK_BUTTON } from '../../utils/buttonStyles';
import SettingOutcome from './SettingOutcome';

// Corpo della finestra «Email»: l'indirizzo con il suo stato, «Scrivi il codice» se da confermare, il cambio in attesa
// con «Scrivi il codice» e «Annulla», e «Cambia indirizzo». «Scrivi il codice» e «Cambia indirizzo» aprono un'altra
// finestra: chi le usa (`onEnterCode`, `onChangeAddress`) chiude prima questa. «Annulla» resta qui e il suo esito si
// legge qui sotto: `cancel` è useEmailChangeCancel. Senza lo stato dell'email (non ancora letto) c'è solo l'indirizzo.
const EmailSettingBody = ({ account, cancel, onEnterCode, onChangeAddress }) => {
  const { t } = useTranslation();
  const { emailState } = useAuth();

  return (
    <>
      <Typography sx={{ fontSize: 16, overflowWrap: 'anywhere' }}>{emailState?.email || account?.email}</Typography>
      {emailState && (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, mt: 0.5 }}>
          {emailState.verified ? (
            <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 16, fontWeight: 600, color: 'success.main' }}>
              <CheckCircleOutlineIcon aria-hidden="true" fontSize="small" />
              {t('emailstatus.confirmed')}
            </Typography>
          ) : (
            <>
              <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 16, fontWeight: 600, color: 'warning.text' }}>
                <ErrorOutlineIcon aria-hidden="true" fontSize="small" />
                {t('emailstatus.unconfirmed')}
              </Typography>
              <Button onClick={onEnterCode} sx={LINK_BUTTON}>
                {t('emailstatus.enter_code')}
              </Button>
            </>
          )}
        </Box>
      )}
      {emailState?.pendingEmail && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: 16, overflowWrap: 'anywhere' }}>
            {t('emailstatus.pending', { email: emailState.pendingEmail })}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
            <Button onClick={onEnterCode} sx={LINK_BUTTON}>
              {t('emailstatus.enter_code')}
            </Button>
            <Button
              onClick={cancel.cancel}
              aria-disabled={cancel.saving || undefined}
              aria-label={t('emailstatus.cancel_aria')}
              sx={LINK_BUTTON}
            >
              {t('common.cancel')}
            </Button>
          </Box>
        </Box>
      )}
      {emailState && (
        <Button variant="outlined" onClick={onChangeAddress} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, mt: 2 }}>
          {t('emailchange.open')}
        </Button>
      )}
      <SettingOutcome status={cancel.status} error={cancel.error} />
    </>
  );
};

export default EmailSettingBody;
