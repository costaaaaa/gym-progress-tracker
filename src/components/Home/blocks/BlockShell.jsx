import { Box, Card, CardActionArea, Collapse, Skeleton, Typography, useMediaQuery } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY, TABULAR } from '../../../utils/fonts';

const COLLAPSE_MS = 250;

// Guscio comune dei blocchi dei moduli. Piccola (di partenza) = una riga tutta cliccabile verso la pagina del modulo:
// titolo, una riga con un dato, a destra l'eventuale segno e la freccia. Grande = la stessa riga in testa e sotto il
// contenuto pieno (`children`); il passaggio è un Collapse, spento da «riduci movimento».
// `status`: 'loading' (titolo e segnaposto) | 'error' (titolo e link restano, la riga dice che i dati non ci sono) | 'ok'.
const BlockShell = ({ title, to, status, summary, sign = null, large = false, children = null }) => {
  const { t } = useTranslation();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const line = (() => {
    if (status === 'loading') return <Skeleton data-testid="block-skeleton" variant="text" width="60%" sx={{ fontSize: 14 }} />;
    if (status === 'error') return <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('home.block.unavailable')}</Typography>;
    return <Typography sx={{ fontSize: 14, color: 'text.secondary', overflowWrap: 'anywhere', ...TABULAR }}>{summary}</Typography>;
  })();
  return (
    <Card data-testid="home-block" aria-busy={status === 'loading' ? 'true' : undefined}>
      <CardActionArea component={RouterLink} to={to} sx={{ minHeight: 44, px: 2.5, py: 1.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h2" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: 16 }}>{title}</Typography>
            {line}
          </Box>
          {status === 'ok' && sign}
          <ChevronRightIcon aria-hidden sx={{ color: 'text.secondary', flexShrink: 0 }} />
        </Box>
      </CardActionArea>
      <Collapse in={large && status === 'ok'} appear={false} timeout={reduceMotion ? 0 : COLLAPSE_MS} unmountOnExit>
        <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Card>
  );
};

export default BlockShell;
