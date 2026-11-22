import { Box, IconButton, Typography } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';

// Pulsanti e intervallo sotto lo storico; `history` è il risultato di paginate()
const HistoryPagination = ({ history, onPageChange }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
      <IconButton size="small" disabled={history.page === 0} onClick={() => onPageChange(0)} aria-label={t('body.page_first')}>
        <FirstPageIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={history.page === 0} onClick={() => onPageChange(history.page - 1)} aria-label={t('body.page_prev')}>
        <NavigateBeforeIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {t('body.page_range', { from: history.from, to: history.to, total: history.total })}
      </Typography>
      <IconButton size="small" disabled={history.page === history.lastPage} onClick={() => onPageChange(history.page + 1)} aria-label={t('body.page_next')}>
        <NavigateNextIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={history.page === history.lastPage} onClick={() => onPageChange(history.lastPage)} aria-label={t('body.page_last')}>
        <LastPageIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default HistoryPagination;
