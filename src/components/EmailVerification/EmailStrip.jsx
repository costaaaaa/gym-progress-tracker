import { Box, Button, Typography } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

// Striscia sotto la barra in alto, in ogni pagina dell'app, finché l'email non è confermata e l'app non è
// bloccata: giorni rimasti e comando che apre la finestra del codice. A 0 o 1 giorno rimasto dice «scade oggi».
const EmailStrip = () => {
  const { t } = useTranslation();
  const { isLoggedIn, emailState, openEmailDialog } = useAuth();
  if (!isLoggedIn || !emailState || emailState.verified || emailState.blocked) return null;

  const days = emailState.daysLeft ?? 0;
  const text = days <= 1 ? t('emailconfirm.strip_today') : t('emailconfirm.strip_days', { count: days });

  return (
    <Box
      role="region"
      aria-label={t('emailconfirm.strip_label')}
      sx={{
        position: 'sticky',
        top: 'var(--navbar-height, 64px)',
        zIndex: 1090,
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
      <Typography sx={{ fontSize: 14, color: 'text.primary', flex: '1 1 200px', minWidth: 0 }}>{text}</Typography>
      <Button
        onClick={openEmailDialog}
        size="small"
        sx={{ minHeight: 44, fontSize: 14, fontWeight: 600, color: 'text.primary', textDecoration: 'underline', '&:hover': { textDecoration: 'underline' } }}
      >
        {t('emailstatus.enter_code')}
      </Button>
    </Box>
  );
};

export default EmailStrip;
