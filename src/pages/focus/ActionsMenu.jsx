import { useId, useRef, useState } from 'react';
import { IconButton, Menu, MenuItem, Box } from '@mui/material';
import { MoreHoriz as MoreIcon, SkipNext as SkipNextIcon, SwapHoriz as SwapIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import PlusTag from './PlusTag';

// Il solo «⋯» della barra: le azioni della serie in corso, che stavano sotto «Conferma serie». Le voci che aprono una
// finestra (Cambia, Aggiungi, Plus) partono a menu chiuso: la finestra ricorda il fuoco su «⋯» e lì lo riporta.
export default function ActionsMenu({ currentSlot, canEditSession, canSwap, onSkipWarmup, onSkipSet, onSkipExercise, onOpenPicker }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const menuId = useId();
  const [anchor, setAnchor] = useState(null);
  const afterClose = useRef(null);
  const open = Boolean(anchor);

  const choose = (action, opensDialog = false) => {
    // Il menu si sta chiudendo ma le voci restano nel DOM: un secondo tocco non rilancia l'azione
    if (!open) return;
    setAnchor(null);
    if (opensDialog) afterClose.current = action;
    else action();
  };
  const onExited = () => {
    const action = afterClose.current;
    afterClose.current = null;
    action?.();
  };

  // Voci come sotto «Conferma serie» prima: in riscaldamento si salta tutto il riscaldamento; dalla seconda serie
  // allenante si salta la serie (saltare la prima equivale a saltare l'esercizio)
  const skips = [
    currentSlot.isWarmup && { label: t('focus.skip_warmup'), action: onSkipWarmup },
    currentSlot.workingIndex > 0 && { label: t('focus.skip_set'), action: onSkipSet },
    { label: t('focus.skip_exercise'), action: onSkipExercise },
  ].filter(Boolean);
  const pickers = [
    { mode: 'swap', label: t('focus.swap_exercise'), icon: <SwapIcon />, faded: !canSwap },
    { mode: 'add', label: t('focus.add_exercise'), icon: <AddIcon /> },
  ];
  const itemSx = { minHeight: 44, gap: 1.5, color: colors.text };

  return (
    <>
      {/* Il fuoco va sul bottone prima di aprire: alcuni browser non lo danno al tocco, e il menu lo riporta dove l'ha trovato */}
      <IconButton onClick={(e) => { e.currentTarget.focus(); setAnchor(e.currentTarget); }} aria-label={t('focus.more_actions')} aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? menuId : undefined} sx={{ width: 44, height: 44, color: colors.textSecondary }}>
        <MoreIcon />
      </IconButton>
      <Menu MenuListProps={{ id: menuId }} anchorEl={anchor} open={open} onClose={() => setAnchor(null)} TransitionProps={{ onExited }}>
        {skips.map(({ label, action }) => (
          <MenuItem key={label} onClick={() => choose(action)} sx={itemSx}>
            <SkipNextIcon />{label}
          </MenuItem>
        ))}
        {pickers.map(({ mode, label, icon, faded }) => (
          <MenuItem key={mode} onClick={() => choose(() => onOpenPicker(mode), true)} aria-label={canEditSession ? undefined : t('focus.plus_aria', { label })}
            aria-disabled={faded ? 'true' : undefined} sx={itemSx}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ...(faded && { opacity: 0.45 }) }}>{icon}{label}</Box>
            {!canEditSession && <PlusTag sx={{ ml: 'auto', bgcolor: 'transparent' }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
