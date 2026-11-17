import { Box, Link, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { plansPath } from '../i18n/paths';
import { radius } from '../theme/radius';

// Riga con lucchetto in cima alla card di una funzione bloccata dal piano Gratis: cosa si sblocca (children),
// l'etichetta "Plus" e il link al confronto dei piani (`compare={false}` lo toglie: con due righe di fila basta un link). /piani non è una rotta della SPA: link a pagina intera.
const LockedRow = ({ children, sx, compare = true }) => {
  const { t, i18n } = useTranslation();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0, mb: 2,
      px: 1.5, py: 0.5, bgcolor: 'background.subtle', borderRadius: radius.md, ...sx,
    }}>
      <LockOutlinedIcon aria-hidden="true" fontSize="small" sx={{ color: 'text.secondary' }} />
      <Typography sx={{ fontSize: 14, color: 'text.primary', flex: '1 1 160px', minWidth: 0 }}>{children}</Typography>
      <Box component="span" sx={{
        fontSize: 12, fontWeight: 700, color: 'text.secondary', border: '1px solid', borderColor: 'divider',
        borderRadius: radius.pill, px: 1, py: 0.25,
      }}>
        {t('plans.label_plus')}
      </Box>
      {compare && (
        <Link href={plansPath(i18n.language)} color="text.primary" underline="always"
          sx={{ fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
          {t('plans.compare')}
        </Link>
      )}
    </Box>
  );
};

export default LockedRow;
