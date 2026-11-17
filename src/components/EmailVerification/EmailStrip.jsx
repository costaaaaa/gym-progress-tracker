import { Box, Button, Typography } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { useTranslation } from 'react-i18next';
import { isToday } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { LINK_BUTTON } from '../../utils/buttonStyles';

// Striscia sotto la barra in alto, in ogni pagina dell'app, finché l'email non è confermata e l'app non è
// bloccata: giorni rimasti e comando che apre la finestra del codice. Dice «scade oggi» solo se il giorno locale
// della scadenza è oggi: con 1 giorno rimasto possono mancare fino a 24 ore, e allora è «ti resta 1 giorno».
const EmailStrip = () => {
  const { t } = useTranslation();
  const { isLoggedIn, emailState, openEmailDialog } = useAuth();
  if (!isLoggedIn || !emailState || emailState.verified || emailState.blocked) return null;

  const deadline = emailState.deadline ? new Date(emailState.deadline) : null;
  const dueToday = deadline !== null && !Number.isNaN(deadline.getTime()) && isToday(deadline);
  const days = Math.max(emailState.daysLeft ?? 1, 1);
  const text = dueToday ? t('emailconfirm.strip_today') : t('emailconfirm.strip_days', { count: days });

  return (
    <Box
      role="region"
      aria-label={t('emailconfirm.strip_label')}
      sx={{
        position: 'sticky',
        top: 'var(--navbar-height, 64px)',
        // Sotto la barra in alto (il tema ha la sua scala)
        zIndex: (theme) => theme.zIndex.appBar - 10,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 1.5,
        px: { xs: 2, md: '32px' },
        py: 0.5,
        bgcolor: 'background.paper',
        backgroundImage: (theme) => `linear-gradient(${theme.palette.warning.muted}, ${theme.palette.warning.muted})`,
        borderBottom: '1px solid',
        borderColor: 'warning.main',
      }}
    >
      <MailOutlineIcon aria-hidden="true" fontSize="small" sx={{ color: 'warning.text' }} />
      <Typography sx={{ fontSize: 16, color: 'text.primary', flex: '1 1 200px', minWidth: 0 }}>{text}</Typography>
      <Button
        onClick={openEmailDialog}
        size="small"
        sx={LINK_BUTTON}
      >
        {t('emailstatus.enter_code')}
      </Button>
    </Box>
  );
};

export default EmailStrip;
