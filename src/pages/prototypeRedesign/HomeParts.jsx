// PROTOTIPO (da buttare): pezzi delle tre Home nuove (saluto, colore, oggi). Dati finti, nessuna chiamata al server.
// BodyVisualizer non è riusato: dipende da i18n e dai dati di recupero veri, quindi qui ne è copiato l'aspetto (righe con barra).
import { Box, Button, LinearProgress, Typography, useTheme } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StarIcon from '@mui/icons-material/Star';
import CheckIcon from '@mui/icons-material/Check';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY, TABULAR } from '../../utils/fonts';
import { cardSx, labelSx, titleSx } from './styles';

const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const DONE = [0, 2];
const TODAY = 3;

export const sentence = (bozza) => (bozza
  ? 'Hai un allenamento a metà: Giorno B, serie 7 di 18.'
  : 'Oggi tocca a Pull. Questa settimana sei a 2 allenamenti su 4.');

// Sette giorni della settimana; onColor = bianco su campo colorato
export const WeekDays = ({ onColor = false }) => {
  const ink = onColor ? '#fff' : undefined;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
      {DAYS.map((d, i) => {
        const done = DONE.includes(i);
        const today = i === TODAY;
        const sx = onColor
          ? { bgcolor: done ? '#fff' : 'transparent', color: 'primary.main', borderColor: done || today ? '#fff' : 'rgba(255,255,255,0.55)' }
          : { bgcolor: done ? 'success.main' : 'transparent', color: 'success.contrastText', borderColor: done ? 'success.main' : today ? 'text.primary' : 'divider' };
        return (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box role="img" aria-label={`${d}${done ? ': fatto' : today ? ': oggi' : ''}`} sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid', ...sx }}>
              {done && <CheckIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Typography variant="caption" sx={{ color: ink ?? 'text.secondary' }}>{d}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

// Card d'apertura della variante saluto: seduta di oggi e settimana insieme
export const TodayWeekCard = ({ bozza, onStart }) => (
  <Box sx={cardSx}>
    <Typography sx={labelSx}>Oggi</Typography>
    <Typography sx={{ ...titleSx, fontSize: '1.5rem', fontWeight: 700, mt: 0.5 }}>Giorno B · Pull</Typography>
    <Typography color="text.secondary" sx={{ mb: 1.5 }}>6 esercizi · circa 55 min</Typography>
    <Button variant="contained" fullWidth size="large" onClick={onStart} sx={{ py: 1.4, fontWeight: 700, borderRadius: radius.xl }}>{bozza ? 'Riprendi' : 'Inizia'}</Button>
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2, pt: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
        <Typography sx={labelSx}>Settimana</Typography>
        <Typography sx={{ fontWeight: 600 }}>2 di 4 allenamenti</Typography>
      </Box>
      <WeekDays />
    </Box>
  </Box>
);

// Campo di colore pieno della variante colore (senza sfumature né ombre)
export const ColorField = ({ bozza, onStart }) => (
  <Box sx={{ bgcolor: 'primary.main', color: '#fff', px: 2, pt: 0.5, pb: 3, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
    <Typography component="h1" sx={{ ...titleSx, fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>Ciao, Andrea</Typography>
    <Typography sx={{ fontSize: 15, mt: 0.5, mb: 2.5 }}>{sentence(bozza)}</Typography>
    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Oggi</Typography>
    <Typography sx={{ ...titleSx, fontSize: '1.5rem', fontWeight: 700, mt: 0.25 }}>Giorno B · Pull</Typography>
    <Typography sx={{ mb: 1.5 }}>6 esercizi · circa 55 min</Typography>
    <Button fullWidth size="large" onClick={onStart} sx={{ py: 1.4, fontWeight: 700, borderRadius: radius.xl, bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: '#fff' } }}>{bozza ? 'Riprendi' : 'Inizia'}</Button>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 2.5, mb: 1.25 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Settimana</Typography>
      <Typography sx={{ fontWeight: 600 }}>2 di 4 allenamenti</Typography>
    </Box>
    <WeekDays onColor />
  </Box>
);

// Streak e livello nella misura grande della variante saluto
export const LevelStreakBig = () => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>4</Typography>
      <Typography sx={{ fontWeight: 600 }}>settimane di fila</Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, mb: 0.75 }}>
      <Typography sx={{ fontWeight: 700 }}>Livello 12</Typography>
      <Typography variant="body2" color="text.secondary" sx={TABULAR}>1.240 / 1.500 punti</Typography>
    </Box>
    <LinearProgress variant="determinate" value={83} aria-label="Avanzamento del livello" sx={{ height: 8, borderRadius: 4 }} />
  </Box>
);

const RECOVERY = [['Petto', 'ready', 100, 'pronto'], ['Dorsali', 'recovering', 60, 'pronto domani'], ['Spalle', 'ready', 100, 'pronto'], ['Quadricipiti', 'fatigued', 25, 'tra 2 giorni'], ['Bicipiti', 'recovering', 70, 'pronto domani'], ['Core', 'ready', 100, 'pronto']];

// Copia dell'aspetto di BodyVisualizer: nome, barra di recupero, scritta a destra
export const RecoveryBars = () => (
  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {RECOVERY.map(([name, st, pct, text]) => (
      <Box component="li" key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography noWrap sx={{ fontSize: 15, width: 96, flexShrink: 0 }}>{name}</Typography>
        <Box role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} sx={{ flex: 1, minWidth: 0, height: 6, borderRadius: '3px', bgcolor: 'divider', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: `recovery.${st}`, borderRadius: '3px' }} />
        </Box>
        <Typography sx={{ width: 92, flexShrink: 0, textAlign: 'right', fontSize: st === 'ready' ? 15 : 13, fontWeight: st === 'ready' ? 600 : 400, color: st === 'ready' ? 'recovery.ready' : 'text.secondary' }}>{text}</Typography>
      </Box>
    ))}
  </Box>
);

// Aspetto di StreakCard (numero con fiamma, anello della settimana, testo)
export const StreakLook = () => {
  const theme = useTheme();
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <Box sx={{ p: '22px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl }}>
      <Typography component="h2" variant="cardTitle" sx={{ mb: 2 }}>Streak</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalFireDepartmentIcon sx={{ fontSize: 30, color: 'warning.text' }} />
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>4</Typography>
        </Box>
        <Box sx={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r={R} fill="none" stroke={theme.palette.divider} strokeWidth="5" />
            <circle cx="30" cy="30" r={R} fill="none" stroke={theme.palette.primary.main} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * 0.5} transform="rotate(-90 30 30)" />
          </svg>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 12, fontWeight: 700 }}>2/4</Typography></Box>
        </Box>
        <Box sx={{ minWidth: 120 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Ancora 2 allenamenti questa settimana</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>Record: 9 settimane</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// Aspetto di LevelCard (stella con il livello, barra, punti)
export const LevelLook = () => (
  <Box sx={{ p: '22px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl }}>
    <Typography component="h2" variant="cardTitle" sx={{ mb: 2 }}>Livello</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StarIcon sx={{ fontSize: 30 }} />
        <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>12</Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 140 }}>
        <LinearProgress variant="determinate" value={83} aria-label="Avanzamento del livello" sx={{ height: 8, borderRadius: 4 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.75, ...TABULAR }}>1.240 / 1.500 punti · 8.340 in tutto</Typography>
      </Box>
    </Box>
  </Box>
);
