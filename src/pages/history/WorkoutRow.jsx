import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Typography,
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Divider,
  Collapse,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TimeZoneBadge from '../../components/TimeZoneBadge';
import { formatDate, formatClockTime } from '../../i18n/format';
import WorkoutDetail from './WorkoutDetail';

const DAY_FORMAT = { weekday: 'long', day: 'numeric', month: 'long' };

// Una riga dell'elenco: la card intera apre il dettaglio; Condividi, Cambia data ed Elimina stanno come icone
// (desktop) o nel menu «Altre azioni» (telefono). `dateLocked`: il server non sposta più la data di questo
// allenamento. Le azioni arrivano dalla pagina: onShare(workout), onEditDate(workout, event), onDelete(workout, event).
const WorkoutRow = ({ workout, isPhone, expanded, onToggle, dateLocked, showDivider, weightUnit, onShare, onEditDate, onDelete }) => {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState(null); // il menu "Altre azioni", null = chiuso
  const rowPanelId = `workout-detail-panel-${workout.id}`;

  // Le azioni di una riga: le usano le icone (desktop) e il menu (telefono); un gesto di swipe potrà usare le stesse
  const actions = [
    { key: 'share', label: t('history.share_aria'), icon: <ShareIcon fontSize="small" />, run: () => onShare(workout) },
    {
      key: 'edit-date', label: t('history.edit_date_aria'), icon: <EditCalendarIcon fontSize="small" />,
      disabled: dateLocked, disabledHint: t('history.date.too_old'),
      run: (e) => onEditDate(workout, e),
    },
    { key: 'delete', label: t('history.delete_aria'), icon: <DeleteIcon fontSize="small" />, run: (e) => onDelete(workout, e) },
  ];

  const workoutDay = formatDate(workout.date, DAY_FORMAT);
  // Nel nome accessibile c'è anche l'anno: due allenamenti dello stesso giorno di anni diversi si distinguono.
  const rowActionName = (label) => t('history.row_action_aria', { action: label, date: formatDate(workout.date, { ...DAY_FORMAT, year: 'numeric' }) });

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      {/* La card intera apre i dettagli. Condividi, modifica e cestino stanno in
          secondaryAction, fuori dal ListItemButton: il loro clic non apre la card. */}
      <ListItem component="div" ContainerComponent="div" disablePadding sx={{ '& > .MuiListItemButton-root': { pr: isPhone ? 10 : 19 } }} secondaryAction={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isPhone ? (
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} size="small" sx={{ color: 'text.secondary' }} aria-label={rowActionName(t('history.more_actions_aria'))}><MoreVertIcon fontSize="small" /></IconButton>
          ) : actions.map((action) => (action.disabled ? (
            <Tooltip key={action.key} title={action.disabledHint}>
              <span><IconButton disabled size="small" aria-label={rowActionName(action.label)}>{action.icon}</IconButton></span>
            </Tooltip>
          ) : (
            <IconButton key={action.key} onClick={action.run} size="small" sx={{ color: 'text.secondary' }} aria-label={rowActionName(action.label)}>{action.icon}</IconButton>
          )))}
          {/* Indicatore: per tastiera e lettori di schermo il comando è la card */}
          <Box component="span" aria-hidden onClick={() => onToggle(workout.id)}
            sx={{ display: 'flex', p: 0.625, color: 'text.secondary', cursor: 'pointer' }}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        </Box>
      }>
        <ListItemButton
          onClick={() => onToggle(workout.id)}
          aria-expanded={expanded}
          aria-controls={rowPanelId}
          data-workout-row={workout.id}
        >
          <ListItemText
            primary={<Typography sx={{ fontWeight: 600, fontSize: 16 }}>{workoutDay}</Typography>}
            secondaryTypographyProps={{ component: 'div' }}
            secondary={(
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.25 }}>
                <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{`${formatClockTime(workout.date)} · ${t('focus.exercises_count', { count: workout.exercises?.length || 0 })}`}</Typography>
                <TimeZoneBadge workout={workout} sx={{ fontSize: 16 }} />
              </Box>
            )}
          />
        </ListItemButton>
      </ListItem>
      <Collapse in={expanded} id={rowPanelId} timeout="auto">
        <WorkoutDetail workout={workout} weightUnit={weightUnit} />
      </Collapse>
      {showDivider && <Divider />}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} MenuListProps={{ 'aria-label': menuAnchor && rowActionName(t('history.more_actions_aria')) }}>
        {menuAnchor && actions.map((action) => (
          <MenuItem
            key={action.key}
            disabled={action.disabled}
            onClick={(e) => { setMenuAnchor(null); action.run(e); }}
            sx={{ maxWidth: 300 }}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>{action.icon}</ListItemIcon>
            <ListItemText
              primary={action.label}
              secondary={action.disabled ? action.disabledHint : undefined}
              secondaryTypographyProps={{ sx: { whiteSpace: 'normal' } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default WorkoutRow;
