import { Box } from '@mui/material';
import LastWorkout from './LastWorkout';
import LevelsBlock from './blocks/LevelsBlock';
import GroupsBlock from './blocks/GroupsBlock';
import RecoveryBlock from './blocks/RecoveryBlock';
import BodyBlock from './blocks/BodyBlock';
import { isModuleActive } from '../../hooks/useModule';
import { effectiveLayout } from '../../utils/homeLayout';

// Lo stato delle richieste della Home ('pending' | 'ok' | 'failed') nel vocabolario dei blocchi ('loading' | 'ok' | 'error')
const BLOCK_STATUS = { pending: 'loading', ok: 'ok', failed: 'error' };

// Blocchi sotto l'apertura, nell'ordine e nella misura del layout salvato sull'account. Un blocco nascosto o il cui
// modulo non è attivo non si disegna, e così non chiama il server. `lastWorkout`: l'ultimo allenamento da mostrare
// (null se non c'è o se è già nell'apertura). `dashboardStatus` e `stats`: quanto la Home ha già letto.
const HomeBlocks = ({ user, weightUnit, lastWorkout, stats, dashboardStatus }) => {
  const blocks = {
    last: () => lastWorkout && <LastWorkout record={lastWorkout} weightUnit={weightUnit} today={stats?.today} />,
    levels: ({ large }) => isModuleActive(user, 'levels') && <LevelsBlock large={large} />,
    groups: ({ large }) => isModuleActive(user, 'groups') && <GroupsBlock large={large} weightUnit={weightUnit} />,
    recovery: ({ large }) => isModuleActive(user, 'recovery') && (
      <RecoveryBlock large={large} status={BLOCK_STATUS[dashboardStatus]} recovery={stats?.recovery} detail={stats?.detail} />
    ),
    body: ({ large }) => isModuleActive(user, 'body') && <BodyBlock large={large} today={stats?.today} weightUnit={weightUnit} />,
  };
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start', gap: 3 }}>
      {effectiveLayout(user?.home_layout).map(({ key, hidden, large }) => {
        const block = hidden ? null : blocks[key]({ large });
        // Un blocco grande occupa tutta la riga da md in su; minWidth 0 lascia che il testo lungo vada a capo
        return block ? <Box key={key} sx={{ minWidth: 0, gridColumn: large ? { md: '1 / -1' } : undefined }}>{block}</Box> : null;
      })}
    </Box>
  );
};

export default HomeBlocks;
