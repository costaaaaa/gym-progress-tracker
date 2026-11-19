// PROTOTIPO (da buttare): menu del pulsante centrale a ventaglio, tondi ad arco sopra il pulsante
import { useEffect, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import StraightenIcon from '@mui/icons-material/Straighten';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

const RADIUS = 140;
// Il centro del pulsante sta 18 px sotto il bordo basso del velo (la barra è alta 64, il pulsante è rialzato di 14)
const BUTTON_BELOW = 18;
// L'arco è centrato 10 px sopra il bordo del velo: così i tondi esterni e le loro etichette restano staccati dalla barra
const ORIGIN_ABOVE = 10;
const ANGLES_FIVE = [148, 119, 90, 61, 32];
const ANGLES_TWO = [90, 61];

// Regola unica del ventaglio compatto: n voci a passo costante, simmetriche rispetto a 90°;
// «Inizia» sta nella posizione di mezzo (con n pari, quella subito a destra del centro)
const COMPACT_RADIUS = 120;
// Arco compatto centrato 28 px sopra il bordo del velo: le etichette basse restano a oltre 8 px dalla barra
const COMPACT_ORIGIN_ABOVE = 28;
const COMPACT_STEP = 40;
const compactAngles = (n) => Array.from({ length: n }, (_, i) => 90 + ((n - 1) / 2 - i) * COMPACT_STEP);

const Fan = ({ open, onClose, onStart, bozza, moduli, compact }) => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return undefined; }
    const id = setTimeout(() => setShown(true), 20);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const inizia = { key: 'inizia', short: bozza ? 'Riprendi' : 'Inizia', full: bozza ? 'Riprendi allenamento' : 'Inizia allenamento', Icon: PlayArrowIcon, main: true, action: onStart };
  const registra = { key: 'registra', short: 'Registra', full: 'Registra allenamento passato', Icon: EditCalendarOutlinedIcon, action: onClose };
  const cardio = { key: 'cardio', short: 'Cardio', full: 'Cardio', Icon: DirectionsRunIcon, action: onClose };
  const misura = { key: 'misura', short: 'Misura', full: 'Nuova misura', Icon: StraightenIcon, action: onClose };
  const coach = { key: 'coach', short: 'Coach', full: 'Chiedi al Coach', Icon: AutoAwesomeOutlinedIcon, action: onClose };
  const items = moduli ? [registra, cardio, inizia, misura, coach] : (compact ? [registra, inizia] : [inizia, registra]);
  const angles = compact ? compactAngles(items.length) : (moduli ? ANGLES_FIVE : ANGLES_TWO);
  const radius = compact ? COMPACT_RADIUS : RADIUS;
  const originAbove = compact ? COMPACT_ORIGIN_ABOVE : ORIGIN_ABOVE;
  const labelGap = compact ? 4 : 5;

  return (
    <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 64, zIndex: 20 }}>
      <Box onClick={onClose} data-testid="fan-veil" sx={{ position: 'absolute', inset: 0, bgcolor: compact ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }} />
      <Box role="group" aria-label="Cosa vuoi fare">
        {items.map((it, i) => {
          const a = (angles[i] * Math.PI) / 180;
          const x = Math.cos(a) * radius;
          const y = Math.sin(a) * radius + originAbove;
          const size = compact ? (it.main ? 56 : 44) : (it.main ? 64 : 52);
          const iconSize = compact ? (it.main ? 26 : 20) : (it.main ? 30 : 24);
          return (
            <Box
              key={it.key}
              sx={{
                position: 'absolute', left: `calc(50% + ${x}px)`, bottom: `${y}px`, width: 0, height: 0,
                transform: shown ? 'translate(0, 0) scale(1)' : `translate(${-x}px, ${y + BUTTON_BELOW}px) scale(0.3)`,
                opacity: shown ? 1 : 0,
                transition: `transform 180ms ease-out ${i * 30}ms, opacity 180ms ease-out ${i * 30}ms`,
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <ButtonBase
                onClick={it.action}
                aria-label={it.full}
                sx={{
                  position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%',
                  bgcolor: it.main ? 'primary.main' : 'background.paper', color: it.main ? 'common.white' : 'text.primary',
                  ...(compact
                    ? { '&::after': { content: '""', position: 'absolute', inset: '-6px' } }
                    : { border: '1px solid', borderColor: it.main ? 'primary.main' : 'divider', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }),
                }}
              >
                <it.Icon sx={{ fontSize: iconSize }} />
              </ButtonBase>
              <Box
                aria-hidden="true"
                sx={{ position: 'absolute', top: size / 2 + labelGap, left: 0, transform: 'translateX(-50%)', color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...(compact ? {} : { px: 0.75, py: '1px', borderRadius: '999px', bgcolor: 'rgba(0,0,0,0.6)' }) }}
              >
                {it.short}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default Fan;
