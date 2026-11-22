import { useState } from 'react';
import { Box, Typography, Card, Avatar, Button, Collapse } from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '../../i18n/format';
import { useAuth } from '../../context/AuthContext';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { NEUTRAL_OUTLINED, LINK_BUTTON } from '../../utils/buttonStyles';
import AccountTier from '../../components/Account/AccountTier';
import ChangeEmailDialog from '../../components/EmailVerification/ChangeEmailDialog';
import { cancelEmailChange } from '../../api/emailVerification';

// Card del profilo: avatar, nome, indirizzo con il suo stato, piano e i due pulsanti. `children` sono le impostazioni che
// si aprono con «Modifica»: la pagina decide se la parte è aperta (`editOpen`, `onToggleEdit`) perché la lettura dei
// dati smonta i pezzi e una parte aperta non deve richiudersi. Il cambio di indirizzo e l'annullamento sono suoi.
const ProfileCard = ({ account, joinDate, notify, editOpen, onToggleEdit, children }) => {
  const { t } = useTranslation();
  const { emailState, openEmailDialog, refreshEmailState } = useAuth();

  // Cambio di indirizzo email: la finestra è ChangeEmailDialog, il codice si scrive nella finestra comune (contesto)
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [cancellingChange, setCancellingChange] = useState(false);

  const handleCancelEmailChange = async () => {
    setCancellingChange(true);
    const res = await cancelEmailChange();
    setCancellingChange(false);
    if (res.ok) {
      await refreshEmailState();
      notify(t('emailstatus.cancelled'), 'success');
    } else {
      notify(res.status === 0 ? t('emailconfirm.error_network') : (res.data?.message || t('emailconfirm.error_generic')), 'error');
    }
  };

  return (
    <>
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: emailState?.pendingEmail ? 'flex-start' : 'center', gap: 2 }}>
          <Avatar sx={{
            width: 64, height: 64,
            bgcolor: 'ink',
            color: 'onInk',
            fontFamily: TITLE_FONT_FAMILY,
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
          }}>
            {account?.username?.charAt(0).toUpperCase() || '?'}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {account?.username || t('account.user_fallback')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {emailState?.email || account?.email || t('account.email_unavailable')}
            </Typography>
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
                    <Button onClick={openEmailDialog} sx={LINK_BUTTON}>
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
                  <Button onClick={openEmailDialog} sx={LINK_BUTTON}>
                    {t('emailstatus.enter_code')}
                  </Button>
                  <Button
                    onClick={handleCancelEmailChange}
                    disabled={cancellingChange}
                    aria-label={t('emailstatus.cancel_aria')}
                    sx={LINK_BUTTON}
                  >
                    {t('common.cancel')}
                  </Button>
                </Box>
              </Box>
            )}
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.member_since', { date: joinDate ? format(joinDate, 'MMMM yyyy', { locale: dateFnsLocale() }) : t('account.date_unavailable') })}
            </Typography>
            <AccountTier tier={account?.tier} lastDay={account?.tier_last_day} signupCode={account?.signup_code} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onToggleEdit}
            sx={NEUTRAL_OUTLINED}
          >
            {t('account.edit')}
          </Button>
          {emailState && (
            <Button variant="outlined" onClick={() => setChangeEmailOpen(true)} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}>
              {t('emailchange.open')}
            </Button>
          )}
        </Box>

        {/* Profilo fisico e impostazioni di allenamento: fuori dal design, restano collassate */}
        <Collapse in={editOpen}>
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {children}
          </Box>
        </Collapse>
      </Card>

      <ChangeEmailDialog open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} onChanged={() => openEmailDialog()} />
    </>
  );
};

export default ProfileCard;
