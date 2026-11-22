import { Box, Typography, Card, Button } from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';

// Card della sessione: il pulsante per uscire.
const SessionCard = () => {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <Card sx={{ p: '24px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="cardTitle">{t('account.session.title')}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
            {t('account.session.help')}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout} sx={NEUTRAL_OUTLINED}>
          {t('account.session.logout')}
        </Button>
      </Box>
    </Card>
  );
};

export default SessionCard;
