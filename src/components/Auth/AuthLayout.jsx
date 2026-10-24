import { Box, Card, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BodyVisualizer from '../BodyVisualizer';
import AuthBars from './AuthBars';
import { buildRecovery } from '../../utils/recoveryDemo';

const SAMPLE = buildRecovery('push');

// Pagine di accesso, tre regole:
// 1. Senza `side` (login, password dimenticata, reset) c'è solo il modulo, centrato in larghezza e in
//    altezza, con ai lati le barre del marchio (AuthBars, solo da md in su).
// 2. Con `side` (registrazione) su desktop a sinistra frase, card dello stato muscolare e didascalia,
//    a destra il modulo; sul telefono solo il modulo.
// 3. Con `side` il bordo alto del modulo coincide con quello della card e il modulo prosegue sotto
//    (righe frase / card / didascalia, il modulo occupa card e didascalia); l'insieme è centrato in
//    altezza come il primo schermo della home.
const AuthLayout = ({ title, side, children }) => {
  const { t } = useTranslation();

  const form = (
    <Paper
      sx={{
        p: { xs: 3, sm: 4 },
        width: '100%',
        maxWidth: 440,
        justifySelf: { md: side ? 'end' : 'center' },
        alignSelf: { md: side ? 'start' : 'center' },
        gridColumn: { md: 2 },
        gridRow: { md: '2 / span 2' },
        // Aiuti ed errori sotto i campi: 14px invece dei 12 di MUI, si leggono e i loro link si toccano
        '& .MuiFormHelperText-root': { fontSize: '0.875rem', lineHeight: 1.45, mt: 0.75 },
      }}
    >
      <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2rem' }, lineHeight: 1.15, mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );

  if (!side) {
    return (
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          // Come il primo schermo della home: sotto la Navbar (64) e il margine del Layout (32).
          minHeight: { xs: '70vh', md: 'calc(100svh - 96px)' },
          pb: { md: 4 },
        }}
      >
        <AuthBars />
        {form}
      </Box>
    );
  }

  return (
    <Box sx={{ display: { md: 'flex' }, alignItems: 'center', justifyContent: 'center', minHeight: { md: 'calc(100svh - 96px)' }, pb: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          width: '100%',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
          gridTemplateRows: { md: 'auto auto 1fr' },
          columnGap: { md: 8 },
          justifyItems: { xs: 'center', md: 'stretch' },
        }}
      >
        <Box sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 1, gridRow: 1, alignSelf: 'end' }}>
          <Typography component="p" variant="h1" sx={{ fontSize: '3rem', lineHeight: 1.05, mb: 2, textWrap: 'balance' }}>
            {side.title}
          </Typography>
          <Typography sx={{ fontSize: 19, lineHeight: 1.55, mb: 4, maxWidth: 520 }}>{side.text}</Typography>
        </Box>
        <Card data-ui aria-hidden sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 1, gridRow: 2, alignSelf: 'start', p: 3 }}>
          <BodyVisualizer recoveryData={SAMPLE} />
        </Card>
        <Typography sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 1, gridRow: 3, alignSelf: 'start', fontSize: 16, color: 'text.secondary', mt: 1.5 }}>
          {t('home.showcase.subtitle')}
        </Typography>
        {form}
      </Box>
    </Box>
  );
};

export default AuthLayout;
