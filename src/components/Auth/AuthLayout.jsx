import { Box, Card, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BodyVisualizer from '../BodyVisualizer';
import { buildRecovery } from '../../pages/landing/recoveryDemo';

const SAMPLE = buildRecovery('push');

// Pagine di accesso. Con `side` lo schema è quello della home pubblica: su desktop a sinistra
// frase e stato muscolare di esempio, a destra il modulo; sul telefono solo il modulo.
// Senza `side` (password dimenticata, reset) il modulo resta al centro.
const AuthLayout = ({ title, side, children }) => {
  const { t } = useTranslation();

  const form = (
    <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 440, justifySelf: { md: side ? 'end' : 'center' } }}>
      <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2rem' }, lineHeight: 1.15, mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );

  if (!side) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>{form}</Box>;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
        gap: { md: 8 },
        alignItems: 'center',
        justifyItems: { xs: 'center', md: 'stretch' },
        // Come il primo schermo della home: sotto la Navbar (64) e il margine del Layout (32).
        minHeight: { md: 'calc(100svh - 96px)' },
        pb: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography component="p" variant="h1" sx={{ fontSize: '3rem', lineHeight: 1.05, mb: 2, textWrap: 'balance' }}>
          {side.title}
        </Typography>
        <Typography sx={{ fontSize: 19, lineHeight: 1.55, mb: 4, maxWidth: 520 }}>{side.text}</Typography>
        <Card data-ui aria-hidden sx={{ p: 3 }}>
          <BodyVisualizer recoveryData={SAMPLE} />
        </Card>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1.5 }}>{t('home.showcase.subtitle')}</Typography>
      </Box>
      {form}
    </Box>
  );
};

export default AuthLayout;
