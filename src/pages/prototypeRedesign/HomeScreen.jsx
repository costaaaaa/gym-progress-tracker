// PROTOTIPO (da buttare): Home con blocchi fissi, blocchi dei moduli e «Modifica Home»
import { useState } from 'react';
import { Avatar, Box, Button, ButtonBase, IconButton, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckIcon from '@mui/icons-material/Check';
import LogoMark from '../../components/LogoMark';
import ModuleCard, { Big, MODULES } from './ModuleBlocks';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY, TABULAR } from '../../utils/fonts';
import { ACTIVE_MODULES } from './useProto';
import { ColorField, LevelLook, WeekDays, RecoveryBars, StreakLook, TodayWeekCard, sentence } from './HomeParts';

const cardSx = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl, p: 2 };
const labelSx = { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'text.secondary', textTransform: 'uppercase' };
const titleSx = { fontFamily: TITLE_FONT_FAMILY, fontWeight: 600 };
const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const DONE = [0, 2];
const TODAY = 3;

export const Header = ({ logo, onAvatar, onColor = false }) => (
  <Box component="header" sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, height: 56, borderBottom: onColor ? 0 : '1px solid', borderColor: 'divider', bgcolor: onColor ? 'primary.main' : 'background.paper', color: onColor ? '#fff' : 'text.primary' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {logo === 'alto' && <Box sx={{ display: 'flex', ...(onColor && { filter: 'brightness(0) invert(1)' }) }}><LogoMark width={22} /></Box>}
      <Typography component="span" sx={{ ...titleSx, fontSize: '1.15rem', fontWeight: 700 }}>Liftindex</Typography>
    </Box>
    <ButtonBase onClick={onAvatar} aria-label="Account" sx={{ borderRadius: '50%', p: '5px', m: '-5px' }}>
      <Avatar sx={{ width: 34, height: 34, bgcolor: onColor ? '#fff' : 'secondary.main', color: onColor ? 'primary.main' : 'background.paper', fontSize: 15, fontWeight: 700 }}>A</Avatar>
    </ButtonBase>
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


// Variante «oggi»: l'aspetto della Home attuale nell'ordine nuovo, tutte le card grandi. «Modifica Home» è finto.
const OggiHome = ({ moduli, bozza, onStart }) => {
  const on = ACTIVE_MODULES[moduli];
  const wrap = (title, child) => (
    <Box sx={{ ...cardSx, p: '22px' }}>
      <Typography component="h2" variant="cardTitle" sx={{ mb: 2 }}>{title}</Typography>
      {child}
    </Box>
  );
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography component="h1" variant="h1" sx={{ fontSize: '1.75rem', mb: 1.5 }}>Ciao, Andrea</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.6 }}>{sentence(bozza)}</Typography>
      </Box>
      <Box sx={{ ...cardSx, p: '22px' }}>
        <Typography component="h2" variant="cardTitle" sx={{ mb: 1 }}>Oggi</Typography>
        <Typography sx={{ ...titleSx, fontSize: '1.3rem' }}>Giorno B · Pull</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>6 esercizi · circa 55 min</Typography>
        <Button variant="contained" fullWidth size="large" onClick={onStart} sx={{ py: 1.4, fontWeight: 700, borderRadius: radius.lg }}>{bozza ? 'Riprendi' : 'Inizia'}</Button>
      </Box>
      {wrap('Settimana', (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>2 di 4 allenamenti</Typography>
          <WeekDays />
        </Box>
      ))}
      {on.includes('livello') && <StreakLook />}
      {on.includes('livello') && <LevelLook />}
      {on.includes('recupero') && wrap('Stato muscolare', <RecoveryBars />)}
      {on.includes('gruppi') && wrap('Gruppi', <Big id="gruppi" />)}
      {wrap('Ultimo allenamento', (
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Giorno A · Push</Typography>
          <Typography color="text.secondary">Mercoledì 18 novembre</Typography>
          <Typography color="text.secondary" sx={TABULAR}>58 min · 9.420 kg di volume</Typography>
        </Box>
      ))}
      {on.includes('peso') && wrap('Peso', <Big id="peso" />)}
      {on.includes('cardio') && wrap('Cardio della settimana', <Big id="cardio" />)}
      <Button sx={{ alignSelf: 'center', minHeight: 44 }}>Modifica Home</Button>
    </Box>
  );
};

const HomeScreen = ({ moduli, home, bozza, onStart }) => {
  const rich = home === 'saluto';
  const attiviIniziali = ACTIVE_MODULES[moduli];
  const [blocks, setBlocks] = useState(() => [{ id: 'ultimo', size: 'small', hidden: false }, ...attiviIniziali.map((id) => ({ id, size: rich && (id === 'livello' || id === 'recupero') ? 'big' : 'small', hidden: false }))]);
  const [editing, setEditing] = useState(false);
  const [proposta, setProposta] = useState(() => ['peso', 'cardio', 'livello', 'gruppi', 'recupero'].find((id) => !attiviIniziali.includes(id)) ?? null);

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

  if (home === 'oggi') return <OggiHome moduli={moduli} bozza={bozza} onStart={onStart} />;

  const righeTop = (
    <>
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

    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {home === 'colore' && <ColorField bozza={bozza} onStart={onStart} />}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {home === 'saluto' && (
          <Box sx={{ pb: 0.5 }}>
            <Typography component="h1" sx={{ ...titleSx, fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>Ciao, Andrea</Typography>
            <Typography sx={{ fontSize: 15, color: 'text.primary', mt: 0.5 }}>{sentence(bozza)}</Typography>
          </Box>
        )}
        {home === 'saluto' && <TodayWeekCard bozza={bozza} onStart={onStart} />}
        {home === 'righe' && righeTop}

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
              <ModuleCard id={b.id} size={b.size} rich={rich} />
            )}
          </Box>
        );
      })}

      {proposta && (
        <Box sx={{ ...cardSx, borderStyle: 'dashed' }}>
          <Typography sx={labelSx}>Prova anche…</Typography>
          <Typography sx={{ ...titleSx, mt: 0.5 }}>{proposta === 'peso' ? 'Peso e misure' : MODULES[proposta]}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>Un blocco in più nella Home, quando vuoi puoi spegnerlo.</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={activate} sx={{ minHeight: 44 }}>Attiva</Button>
            <Button onClick={() => setProposta(null)} sx={{ minHeight: 44 }}>No, grazie</Button>
          </Box>
        </Box>
      )}

      <Button onClick={() => setEditing((e) => !e)} sx={{ alignSelf: 'center', minHeight: 44, mt: 0.5 }}>{editing ? 'Fine' : 'Modifica Home'}</Button>
      </Box>
    </Box>
  );
};

export default HomeScreen;
