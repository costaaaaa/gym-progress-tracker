// PROTOTIPO (da buttare): Home con blocchi fissi, blocchi dei moduli e «Modifica Home»
import { useState } from 'react';
import { Avatar, Box, Button, IconButton, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckIcon from '@mui/icons-material/Check';
import LogoMark from '../../components/LogoMark';
import ModuleCard, { MODULES } from './ModuleBlocks';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY, TABULAR } from '../../utils/fonts';

const cardSx = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl, p: 2 };
const labelSx = { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'text.secondary', textTransform: 'uppercase' };
const titleSx = { fontFamily: TITLE_FONT_FAMILY, fontWeight: 600 };
const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const DONE = [0, 2];
const TODAY = 3;

export const Header = ({ logo }) => (
  <Box component="header" sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, height: 56, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {logo === 'alto' && <LogoMark width={22} />}
      <Typography component="span" sx={{ ...titleSx, fontSize: '1.15rem', fontWeight: 700 }}>Liftindex</Typography>
    </Box>
    <Avatar aria-label="Account" sx={{ width: 34, height: 34, bgcolor: 'secondary.main', color: 'background.paper', fontSize: 15, fontWeight: 700 }}>A</Avatar>
  </Box>
);

const Toolbar = ({ index, count, block, onMove, onHide, onSize }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
    <IconButton size="small" aria-label="Sposta su" disabled={index === 0} onClick={() => onMove(-1)} sx={{ width: 44, height: 44 }}><ArrowUpwardIcon /></IconButton>
    <IconButton size="small" aria-label="Sposta giù" disabled={index === count - 1} onClick={() => onMove(1)} sx={{ width: 44, height: 44 }}><ArrowDownwardIcon /></IconButton>
    <Button size="small" onClick={onHide} sx={{ minHeight: 44 }}>{block.hidden ? 'Mostra' : 'Nascondi'}</Button>
    {block.id !== 'ultimo' && <Button size="small" onClick={onSize} sx={{ minHeight: 44 }}>{block.size === 'big' ? 'Piccola' : 'Grande'}</Button>}
  </Box>
);

const HomeScreen = ({ moduli, bozza, onStart }) => {
  const attiviIniziali = moduli === 'tutti' ? Object.keys(MODULES) : [];
  const [blocks, setBlocks] = useState(() => [{ id: 'ultimo', size: 'small', hidden: false }, ...attiviIniziali.map((id) => ({ id, size: 'small', hidden: false }))]);
  const [editing, setEditing] = useState(false);
  const [proposta, setProposta] = useState(() => Object.keys(MODULES).find((id) => !attiviIniziali.includes(id)) ?? null);

  const update = (id, patch) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (index, delta) => setBlocks((bs) => {
    const next = [...bs];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  });
  const activate = () => {
    setBlocks((bs) => [...bs, { id: proposta, size: 'small', hidden: false }]);
    setProposta(null);
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Oggi</Typography>
        <Typography sx={{ ...titleSx, fontSize: '1.3rem', mt: 0.5 }}>Giorno B · Pull</Typography>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>6 esercizi · circa 55 min</Typography>
        <Button variant="contained" fullWidth size="large" onClick={onStart} sx={{ py: 1.4, fontWeight: 700, borderRadius: radius.xl }}>{bozza ? 'Riprendi' : 'Inizia'}</Button>
      </Box>

      <Box sx={cardSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
          <Typography sx={labelSx}>Settimana</Typography>
          <Typography sx={{ fontWeight: 600 }}>2 di 4 allenamenti</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {DAYS.map((d, i) => {
            const done = DONE.includes(i);
            return (
              <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box
                  role="img"
                  aria-label={`${d}${done ? ': fatto' : i === TODAY ? ': oggi' : ''}`}
                  sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: done ? 'success.main' : 'transparent', color: 'success.contrastText', border: '2px solid', borderColor: done ? 'success.main' : i === TODAY ? 'text.primary' : 'divider' }}
                >
                  {done && <CheckIcon sx={{ fontSize: 18 }} />}
                </Box>
                <Typography variant="caption" color="text.secondary">{d}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {blocks.map((b, i) => {
        if (b.hidden && !editing) return null;
        return (
          <Box key={b.id} sx={{ opacity: b.hidden ? 0.5 : 1 }}>
            {editing && <Toolbar index={i} count={blocks.length} block={b} onMove={(d) => move(i, d)} onHide={() => update(b.id, { hidden: !b.hidden })} onSize={() => update(b.id, { size: b.size === 'big' ? 'small' : 'big' })} />}
            {b.id === 'ultimo' ? (
              <Box sx={cardSx}>
                <Typography sx={labelSx}>Ultimo allenamento</Typography>
                <Typography sx={{ ...titleSx, mt: 0.5 }}>Giorno A · Push</Typography>
                <Typography color="text.secondary">Mercoledì 18 novembre</Typography>
                <Typography color="text.secondary" sx={TABULAR}>58 min · 9.420 kg di volume</Typography>
              </Box>
            ) : (
              <ModuleCard id={b.id} size={b.size} />
            )}
          </Box>
        );
      })}

      {proposta && (
        <Box sx={{ ...cardSx, borderStyle: 'dashed' }}>
          <Typography sx={labelSx}>Prova anche…</Typography>
          <Typography sx={{ ...titleSx, mt: 0.5 }}>{MODULES[proposta]}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>Un blocco in più nella Home, quando vuoi puoi spegnerlo.</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={activate} sx={{ minHeight: 44 }}>Attiva</Button>
            <Button onClick={() => setProposta(null)} sx={{ minHeight: 44 }}>No, grazie</Button>
          </Box>
        </Box>
      )}

      <Button onClick={() => setEditing((e) => !e)} sx={{ alignSelf: 'center', minHeight: 44, mt: 0.5 }}>{editing ? 'Fine' : 'Modifica Home'}</Button>
    </Box>
  );
};

export default HomeScreen;
