import { useTranslation } from 'react-i18next';
import BlockShell from './BlockShell';
import { useBlockData } from './useBlockData';
import LeaderboardTable from '../../Groups/LeaderboardTable';
import { listGroups, readGroup } from '../../../api/groups';

const TOP = 3;

// Il primo gruppo dell'elenco e, se c'è almeno un gruppo, la sua classifica della settimana (una chiamata in più).
// La classifica si vede se chi guarda mostra il dato (`visibility.workouts`) e la sua riga c'è; se la lettura della
// classifica non riesce l'elenco basta: nome e membri.
const load = async () => {
  const list = await listGroups();
  if (!list.ok) return null;
  const group = list.data.groups?.[0] ?? null;
  if (!group) return { group: null, board: null };
  const reading = await readGroup(group.id, 'week');
  const rows = reading.ok && reading.data.visibility?.workouts !== false && Array.isArray(reading.data.board) ? reading.data.board : [];
  const mine = rows.find((row) => row.is_me) ?? null;
  return { group, board: mine ? { rows, mine } : null };
};

// I primi tre e, se non è tra i tre, la propria riga
const shownRows = ({ rows, mine }) => (rows.slice(0, TOP).includes(mine) ? rows.slice(0, TOP) : [...rows.slice(0, TOP), mine]);

const GroupsBlock = ({ large = false, weightUnit = 'kg' }) => {
  const { t } = useTranslation();
  const { status, data } = useBlockData(load);
  const { group, board } = data ?? {};
  const summary = (() => {
    if (!group) return t('home.block.groups_none');
    const where = board ? t('home.block.groups_rank', { count: board.mine.rank, ordinal: true }) : t('groups_card.members', { count: Number(group.members_count) });
    return `${group.name} · ${where}`;
  })();
  return (
    <BlockShell title={t('groups.title')} to="/gruppi" status={status} summary={summary} large={large && Boolean(board)}>
      {board && <LeaderboardTable rows={shownRows(board)} board="week" weightUnit={weightUnit} />}
    </BlockShell>
  );
};

export default GroupsBlock;
