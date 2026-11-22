import { Box, Typography, Card, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';

// Card dell'amministrazione: porta alla pagina admin. La pagina la mostra solo agli amministratori.
const AdminCard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card sx={{ p: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography variant="cardTitle">{t('account.admin.title')}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('account.admin.help')}</Typography>
      </Box>
      <Button variant="outlined" onClick={() => navigate('/admin')} sx={{ ...NEUTRAL_OUTLINED, flexShrink: 0 }}>{t('account.admin.open')}</Button>
    </Card>
  );
};

export default AdminCard;
