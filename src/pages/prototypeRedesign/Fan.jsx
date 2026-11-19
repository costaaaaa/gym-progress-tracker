// PROTOTIPO (da buttare): menu del pulsante centrale a ventaglio, tondi ad arco sopra il pulsante
import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import StraightenIcon from '@mui/icons-material/Straighten';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

// Il centro del pulsante sta 18 px sotto il bordo basso del velo (la barra è alta 64, il pulsante è rialzato di 14)
const BUTTON_BELOW = 18;
const LONG_PRESS_MS = 400;

// Regola a passo costante: n voci simmetriche rispetto a 90°; «Inizia» sta nella posizione di mezzo
// (con n pari, quella subito a destra del centro)
const arcAngles = (n, step) => Array.from({ length: n }, (_, i) => 90 + ((n - 1) / 2 - i) * step);
const polar = (angles, radius, originAbove) => angles.map((deg) => ({
  x: Math.cos((deg * Math.PI) / 180) * radius,
  y: Math.sin((deg * Math.PI) / 180) * radius + originAbove,
}));

// Ventaglio grande: le due tabelle di angoli di prima, raggio 140, centrato 10 px sopra il bordo del velo
const GRANDI_FIVE = [148, 119, 90, 61, 32];
const GRANDI_TWO = [90, 61];
// Ventaglio stretto con cinque voci: coordinate rispetto al centro dell'arco (x a destra, y in alto), etichette
// di Cardio e Misura sopra il tondo. L'arco sta 14 px sopra il bordo del velo (etichette basse a 8 px o più dalla barra)
const STRETTI_FIVE = [{ x: -92, y: 36 }, { x: -56, y: 78, above: true }, { x: 0, y: 96 }, { x: 56, y: 78, above: true }, { x: 92, y: 36 }];
const STRETTI_ORIGIN = 14;

// Ventaglio medio con cinque voci: via di mezzo tra compatti e stretti, etichette tutte sotto il tondo.
// I tondi esterni stanno appena oltre le etichette di Cardio e Misura (6 px), quelli interni appena oltre «Riprendi»
const MEDI_FIVE = [{ x: -104, y: 40 }, { x: -56, y: 92 }, { x: 0, y: 112 }, { x: 56, y: 92 }, { x: 104, y: 40 }];
const MEDI_ORIGIN = 12;

const layoutFor = (variant, n) => {
  if (variant === 'medi') return n === 5 ? MEDI_FIVE.map((q) => ({ ...q, y: q.y + MEDI_ORIGIN })) : polar(arcAngles(n, 40), 110, MEDI_ORIGIN);
  if (variant === 'grandi') {
    const angles = n === 5 ? GRANDI_FIVE : n === 2 ? GRANDI_TWO : arcAngles(n, 29);
    return polar(angles, 140, 10);
  }
  if (variant === 'compatti') return polar(arcAngles(n, 40), 120, 28);
  if (variant === 'icone') return polar(arcAngles(n, 38), 96, 14);
  if (n === 5) return STRETTI_FIVE.map((p) => ({ ...p, y: p.y + STRETTI_ORIGIN }));
  return polar(arcAngles(n, 40), 96, STRETTI_ORIGIN);
};

const Fan = ({ open, onClose, onStart, bozza, voci, variant }) => {
  const [shown, setShown] = useState(false);
  const [tip, setTip] = useState(null);
  const timer = useRef(null);
  const longPressed = useRef(false);

  useEffect(() => {
    if (!open) { setShown(false); setTip(null); return undefined; }
    const id = setTimeout(() => setShown(true), 20);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); clearTimeout(timer.current); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const inizia = { key: 'inizia', short: bozza ? 'Riprendi' : 'Inizia', full: bozza ? 'Riprendi allenamento' : 'Inizia allenamento', Icon: PlayArrowIcon, main: true, action: onStart };
  const registra = { key: 'registra', short: 'Registra', full: 'Registra allenamento passato', Icon: EditCalendarOutlinedIcon, action: onClose };
  const cardio = { key: 'cardio', short: 'Cardio', full: 'Cardio', Icon: DirectionsRunIcon, action: onClose };
  const misura = { key: 'misura', short: 'Misura', full: 'Nuova misura', Icon: StraightenIcon, action: onClose };
  const coach = { key: 'coach', short: 'Coach', full: 'Chiedi al Coach', Icon: AutoAwesomeOutlinedIcon, action: onClose };
  const items = [registra, voci.cardio && cardio, inizia, voci.misura && misura, voci.coach && coach].filter(Boolean);
  const positions = layoutFor(variant, items.length);
  const grandi = variant === 'grandi';
  const icone = variant === 'icone';

  const startPress = (key) => {
    longPressed.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { longPressed.current = true; setTip(key); }, LONG_PRESS_MS);
  };
  const endPress = () => { clearTimeout(timer.current); setTip(null); };

  return (
    <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 64, zIndex: 20 }}>
      <Box onClick={onClose} data-testid="fan-veil" sx={{ position: 'absolute', inset: 0, bgcolor: grandi ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.6)' }} />
      <Box role="group" aria-label="Cosa vuoi fare">
        {items.map((it, i) => {
          const { x, y, above } = positions[i];
          const size = grandi ? (it.main ? 64 : 52) : icone ? (it.main ? 60 : 48) : (it.main ? 56 : 44);
          const iconSize = grandi ? (it.main ? 30 : 24) : icone ? (it.main ? 28 : 22) : (it.main ? 26 : 20);
          const labelGap = grandi ? 5 : 4;
          const pillSx = { px: 0.75, py: '1px', borderRadius: '999px', bgcolor: 'rgba(0,0,0,0.6)' };
          const labelBase = { position: 'absolute', left: 0, transform: 'translateX(-50%)', color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
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
                onClick={(e) => {
                  if (longPressed.current) { longPressed.current = false; e.preventDefault(); return; }
                  it.action();
                }}
                aria-label={it.full}
                {...(icone ? {
                  onPointerDown: () => startPress(it.key),
                  onPointerUp: endPress,
                  onPointerLeave: endPress,
                  onPointerCancel: endPress,
                  onContextMenu: (e) => e.preventDefault(),
                  onMouseEnter: () => setTip(it.key),
                  onMouseLeave: () => setTip(null),
                } : {})}
                sx={{
                  position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%',
                  bgcolor: it.main ? 'primary.main' : (grandi ? 'background.paper' : (t) => (t.palette.mode === 'dark' ? '#2e2e30' : '#f2f2f2')),
                  color: it.main ? 'common.white' : (grandi ? 'text.primary' : (t) => (t.palette.mode === 'dark' ? '#fff' : '#111')),
                  // Tema scuro: tondo scuro, staccato dal velo da un bordo chiaro sottile
                  ...(!it.main && !grandi ? { boxShadow: (t) => (t.palette.mode === 'dark' ? 'inset 0 0 0 1px rgba(255,255,255,0.22)' : 'none') } : {}),
                  userSelect: 'none', WebkitTouchCallout: 'none',
                  ...(grandi
                    ? { border: '1px solid', borderColor: it.main ? 'primary.main' : 'divider', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }
                    : { '&::after': { content: '""', position: 'absolute', inset: '-6px' } }),
                }}
              >
                <it.Icon sx={{ fontSize: iconSize }} />
              </ButtonBase>
              {!icone && (
                <Box
                  aria-hidden="true"
                  sx={{ ...labelBase, ...(above ? { bottom: size / 2 + labelGap } : { top: size / 2 + labelGap }), ...(grandi ? pillSx : {}) }}
                >
                  {it.short}
                </Box>
              )}
              {icone && tip === it.key && (
                <Box aria-hidden="true" sx={{ ...labelBase, bottom: size / 2 + 6, ...pillSx, bgcolor: 'rgba(0,0,0,0.85)', py: '3px', px: 1 }}>
                  {it.short}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default Fan;
