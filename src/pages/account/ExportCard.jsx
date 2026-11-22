import { Box, Typography, Card, Button } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import ButtonSpinner from '../../components/ButtonSpinner';
import useDataExport from '../../hooks/useDataExport';

// Card dell'esportazione dei dati: scarica un JSON completo generato dal server (vedi useDataExport).
const ExportCard = ({ username, notify }) => {
  const { t } = useTranslation();
  const { exporting: exportLoading, download: handleDownloadData } = useDataExport(username, notify);

  return (
    <Card sx={{ p: '24px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="cardTitle">{t('account.export.title')}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
            {t('account.export.help')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={exportLoading ? <ButtonSpinner size={16} /> : <DownloadIcon />}
          onClick={handleDownloadData}
          disabled={exportLoading}
          sx={NEUTRAL_OUTLINED}
        >
          {t('account.export.button')}
        </Button>
      </Box>
    </Card>
  );
};

export default ExportCard;
