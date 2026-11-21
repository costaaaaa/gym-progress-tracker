import { useEffect, useRef, useState } from 'react';
import { Box, Card, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { useTranslation } from 'react-i18next';
import LastWorkout from './LastWorkout';
import LevelsBlock from './blocks/LevelsBlock';
import GroupsBlock from './blocks/GroupsBlock';
import RecoveryBlock from './blocks/RecoveryBlock';
import BodyBlock from './blocks/BodyBlock';
import { isModuleActive } from '../../hooks/useModule';
import EditControls from './blocks/EditControls';
import { BlockEditContext } from './blocks/blockEdit';
import { effectiveLayout, moveBlock, setHidden, setLarge } from '../../utils/homeLayout';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { DASHED_CARD } from './labelStyle';

// Lo stato delle richieste della Home ('pending' | 'ok' | 'failed') nel vocabolario dei blocchi ('loading' | 'ok' | 'error')
const BLOCK_STATUS = { pending: 'loading', ok: 'ok', failed: 'error' };

// Il titolo di ogni blocco (nomi dei comandi, annunci e segnaposto dei blocchi nascosti)
const TITLE_KEYS = { last: 'home.last.title', levels: 'home.block.levels_title', groups: 'groups.title', recovery: 'home.block.recovery_title', body: 'home.block.body_title' };

// Un blocco nascosto in modifica: solo titolo e «Nascosto» (scritto, non solo il colore) e i comandi; non carica dati
const HiddenBlock = ({ title, controls }) => {
  const { t } = useTranslation();
  return (
    <Card data-testid="home-block-hidden" sx={DASHED_CARD}>
      <Box sx={{ px: 2.5, py: 1.75, minHeight: 44 }}>
        <Typography component="h2" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: 16, color: 'text.secondary' }}>{title}</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('home.edit.hidden')}</Typography>
      </Box>
      {controls}
    </Card>
  );
};

// Blocchi sotto l'apertura, nell'ordine e nella misura del layout salvato sull'account (o di `layout`, se la Home lo
// tiene lei in modifica). Un blocco nascosto o il cui modulo non è attivo non si disegna, e così non chiama il server.
// `lastWorkout`: l'ultimo allenamento da mostrare (null se non c'è o se è già nell'apertura). `dashboardStatus` e
// `stats`: quanto la Home ha già letto.
// In modifica (`editing`) si vedono anche i blocchi nascosti (solo titolo) e ognuno ha i suoi comandi; `onChange(mossa)`
// applica una mossa sul layout (la mossa prende il layout e ne restituisce uno nuovo; `onChange` restituisce il risultato).
const HomeBlocks = ({ user, weightUnit, lastWorkout, stats, dashboardStatus, editing = false, layout = null, onChange = null }) => {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState('');
  // Il bottone premuto: dopo il disegno il fuoco ci torna (il blocco può essere stato spostato o rifatto da capo)
  const focusAfter = useRef(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    document.querySelector(`[data-edit-key="${target.key}"][data-edit-action="${target.action}"]`)?.focus();
  });
  const blocks = {
    last: () => (editing || lastWorkout) && <LastWorkout record={lastWorkout} weightUnit={weightUnit} today={stats?.today} />,
    levels: ({ large }) => isModuleActive(user, 'levels') && <LevelsBlock large={large} />,
    groups: ({ large }) => isModuleActive(user, 'groups') && <GroupsBlock large={large} weightUnit={weightUnit} />,
    recovery: ({ large }) => isModuleActive(user, 'recovery') && (
      <RecoveryBlock large={large} status={BLOCK_STATUS[dashboardStatus]} recovery={stats?.recovery} detail={stats?.detail} />
    ),
    body: ({ large }) => isModuleActive(user, 'body') && <BodyBlock large={large} today={stats?.today} weightUnit={weightUnit} />,
  };
  const entries = layout ?? effectiveLayout(user?.home_layout);
  // I blocchi che l'utente vede in modifica: «last» e quelli dei moduli attivi, nascosti compresi
  const isListed = (key) => key === 'last' || isModuleActive(user, key);
  const listedKeys = (list) => list.filter((entry) => isListed(entry.key)).map((entry) => entry.key);

  const act = (key, action) => {
    const title = t(TITLE_KEYS[key]);
    const move = {
      up: (current) => moveBlock(current, key, -1, isListed),
      down: (current) => moveBlock(current, key, 1, isListed),
      hide: (current) => setHidden(current, key, !current.find((entry) => entry.key === key).hidden),
      large: (current) => setLarge(current, key, !current.find((entry) => entry.key === key).large),
    }[action];
    const before = JSON.stringify(entries);
    const next = onChange(move);
    if (JSON.stringify(next) === before) return;
    focusAfter.current = { key, action };
    const entry = next.find((candidate) => candidate.key === key);
    const messages = {
      up: () => t('home.edit.moved', { title, position: listedKeys(next).indexOf(key) + 1, count: listedKeys(next).length }),
      hide: () => t(entry.hidden ? 'home.edit.now_hidden' : 'home.edit.now_shown', { title }),
      large: () => t(entry.large ? 'home.edit.now_large' : 'home.edit.now_small', { title }),
    };
    setAnnouncement(messages[action === 'down' ? 'up' : action]());
  };

  const listed = listedKeys(entries);
  return (
    <>
      {editing && <Box role="status" aria-live="polite" sx={visuallyHidden}>{announcement}</Box>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start', gap: 3 }}>
        {entries.map(({ key, hidden, large }) => {
          if (editing && !isListed(key)) return null;
          const position = listed.indexOf(key);
          const controls = editing && (
            <EditControls
              blockKey={key}
              title={t(TITLE_KEYS[key])}
              hidden={hidden}
              large={large}
              canResize={key !== 'last'}
              first={position === 0}
              last={position === listed.length - 1}
              onAction={act}
            />
          );
          let block;
          if (editing && hidden) block = <HiddenBlock title={t(TITLE_KEYS[key])} controls={controls} />;
          else if (hidden) block = null;
          else {
            const content = blocks[key]({ large });
            block = editing && content ? <BlockEditContext.Provider value={controls}>{content}</BlockEditContext.Provider> : content;
          }
          // Un blocco grande occupa tutta la riga da md in su; minWidth 0 lascia che il testo lungo vada a capo
          return block ? <Box key={key} sx={{ minWidth: 0, gridColumn: large && !hidden ? { md: '1 / -1' } : undefined }}>{block}</Box> : null;
        })}
      </Box>
    </>
  );
};

export default HomeBlocks;
