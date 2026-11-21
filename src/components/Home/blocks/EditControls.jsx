import { Box, Button, IconButton } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';

const TOUCH = 44;
// Disabilitato ai capi ma ancora raggiungibile: dopo uno spostamento il fuoco resta sul bottone premuto
const DISABLED = { '&[aria-disabled="true"]': { opacity: 0.38, cursor: 'default' } };

// I comandi di un blocco in modifica: sposta su e giù (disabilitati ai capi), nascondi/mostra, grande/piccola (non per
// «Ultimo allenamento»: `canResize` falso). `onAction(key, 'up' | 'down' | 'hide' | 'large')`. I nomi dicono quale blocco.
const EditControls = ({ blockKey, title, hidden, large, canResize, first, last, onAction }) => {
  const { t } = useTranslation();
  const mark = (action) => ({ 'data-edit-key': blockKey, 'data-edit-action': action });
  const move = (action, edge, label, icon) => (
    <IconButton
      {...mark(action)}
      aria-label={t(label, { title })}
      aria-disabled={edge ? 'true' : undefined}
      onClick={() => { if (!edge) onAction(blockKey, action); }}
      sx={{ width: TOUCH, height: TOUCH, ...DISABLED }}
    >
      {icon}
    </IconButton>
  );
  return (
    <Box role="group" aria-label={t('home.edit.controls', { title })} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, px: 1.5, pb: 1.5 }}>
      {move('up', first, 'home.edit.move_up', <ArrowUpwardIcon aria-hidden />)}
      {move('down', last, 'home.edit.move_down', <ArrowDownwardIcon aria-hidden />)}
      <Button {...mark('hide')} aria-label={t(hidden ? 'home.edit.show_aria' : 'home.edit.hide_aria', { title })} onClick={() => onAction(blockKey, 'hide')} sx={{ minHeight: TOUCH, minWidth: TOUCH, fontSize: 14 }}>
        {t(hidden ? 'home.edit.show' : 'home.edit.hide')}
      </Button>
      {canResize && !hidden && (
        <Button {...mark('large')} aria-label={t(large ? 'home.edit.small_aria' : 'home.edit.large_aria', { title })} onClick={() => onAction(blockKey, 'large')} sx={{ minHeight: TOUCH, minWidth: TOUCH, fontSize: 14 }}>
          {t(large ? 'home.edit.small' : 'home.edit.large')}
        </Button>
      )}
    </Box>
  );
};

export default EditControls;
