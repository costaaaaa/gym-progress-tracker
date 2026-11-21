import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';

// Etichetta «Plus» delle funzioni bloccate: solo disegno, il nome accessibile lo dice il controllo che la porta
// (focus.plus_aria). Lo sfondo della pagina copre la linea del bordo quando sta sopra un bottone.
const PlusTag = ({ sx }) => {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box component="span" aria-hidden="true" sx={{
      bgcolor: colors.bg, color: colors.textSecondary, fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap',
      pointerEvents: 'none', px: 0.5, ...sx,
    }}>
      {t('plans.label_plus')}
    </Box>
  );
};

export default PlusTag;
