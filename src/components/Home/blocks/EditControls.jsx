import { Box, Button, IconButton } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { DISABLED } from '../homeStyles';
import { EDIT_ACTIONS } from './blockEdit';

const TOUCH = 44;

// I comandi di un blocco in modifica (`entry`: la sua voce del layout): sposta su e giù (disabilitati ai capi),
// nascondi/mostra, grande/piccola (non per «Ultimo allenamento»: `canResize` falso). `onAction(key, azione)`: le azioni
// sono quelle di `EDIT_ACTIONS`. I nomi dicono quale blocco.
const EditControls = ({ entry, title, canResize, first, last, onAction }) => {
  const { t } = useTranslation();
  const { key, hidden } = entry;
  const mark = (action) => ({ 'data-edit-key': key, 'data-edit-action': action });
  const aria = (action) => t(EDIT_ACTIONS[action].aria(entry), { title });
  const move = (action, edge, icon) => (
    <IconButton
      {...mark(action)}
      aria-label={aria(action)}
      aria-disabled={edge ? 'true' : undefined}
      onClick={() => { if (!edge) onAction(key, action); }}
      sx={{ width: TOUCH, height: TOUCH, ...DISABLED }}
    >
      {icon}
    </IconButton>
  );
  const text = (action) => (
    <Button {...mark(action)} aria-label={aria(action)} onClick={() => onAction(key, action)} sx={{ minHeight: TOUCH, minWidth: TOUCH, fontSize: 14 }}>
      {t(EDIT_ACTIONS[action].label(entry))}
    </Button>
  );
  return (
    <Box role="group" aria-label={t('home.edit.controls', { title })} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, px: 1.5, pb: 1.5 }}>
      {move('up', first, <ArrowUpwardIcon aria-hidden />)}
      {move('down', last, <ArrowDownwardIcon aria-hidden />)}
      {text('hide')}
      {canResize && !hidden && text('large')}
    </Box>
  );
};

export default EditControls;
