import { Card, TableContainer, useMediaQuery, useTheme } from '@mui/material';
import HistoryList from './HistoryList';
import HistoryTable from './HistoryTable';
import HistoryPagination from './HistoryPagination';

// Storico delle misurazioni: lista sotto `sm`, tabella da `sm`, paginazione. `history` è il risultato di paginate()
const BodyHistory = ({ history, empty, onDelete, onPageChange, weightUnit }) => {
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  return (
    <TableContainer component={Card} sx={{ p: 0 }}>
      {isPhone ? (
        <HistoryList rows={history.rows} empty={empty} onDelete={onDelete} weightUnit={weightUnit} />
      ) : (
        <HistoryTable rows={history.rows} empty={empty} onDelete={onDelete} weightUnit={weightUnit} />
      )}
      {history.total > 0 && <HistoryPagination history={history} onPageChange={onPageChange} />}
    </TableContainer>
  );
};

export default BodyHistory;
