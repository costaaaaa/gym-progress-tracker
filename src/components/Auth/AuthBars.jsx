import { Box } from '@mui/material';

// Decoro delle pagine di accesso: il modulo prende il posto del centro del marchio, con due barre per
// lato (a sinistra corta e lunga, a destra lunga e corta) nelle proporzioni di LogoMark. L è il tratto
// della barra lunga: spessore 0.22 L, tratto della corta 0.48 L, capi tondi. Si adatta alla metà libera
// accanto al modulo (container query) fino a 340 px. Solo da md in su, decorativo, mai sopra al modulo.
const FORM = 440;
const MAX_L = 340;
const THICK = 0.22;
const GAP_FORM = 0.47;
const GAP_BARS = 0.125;
const EXTENT = GAP_FORM + THICK + GAP_BARS + THICK;

const Bar = ({ line }) => (
  <Box
    sx={{
      flex: 'none',
      width: `calc(var(--L) * ${THICK})`,
      height: `calc(var(--L) * ${line + THICK})`,
      borderRadius: 999,
      bgcolor: 'text.primary',
    }}
  />
);

const Gap = ({ k }) => <Box sx={{ flex: 'none', width: `calc(var(--L) * ${k})` }} />;

const AuthBars = () => (
  <Box
    aria-hidden
    sx={{
      display: { xs: 'none', md: 'flex' },
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 32, // lo stesso pb del contenitore: il centro verticale è quello del modulo
      alignItems: 'center',
      justifyContent: 'center',
      containerType: 'inline-size',
      pointerEvents: 'none',
      '--L': `min(${MAX_L}px, calc(((100cqw - ${FORM}px) / 2) / ${EXTENT}))`,
      opacity: 0.08,
    }}
  >
    <Bar line={0.48} />
    <Gap k={GAP_BARS} />
    <Bar line={1} />
    <Gap k={GAP_FORM} />
    <Box sx={{ flex: 'none', width: FORM }} />
    <Gap k={GAP_FORM} />
    <Bar line={1} />
    <Gap k={GAP_BARS} />
    <Bar line={0.48} />
  </Box>
);

export default AuthBars;
