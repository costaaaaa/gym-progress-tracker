import { useTranslation } from 'react-i18next';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useModule } from './useModule';
import { hasFocusSessionInProgress } from '../utils/focusDraft';

// Le azioni del pulsante centrale (ventaglio sul telefono) e del pulsante diviso (barra in alto sul desktop): l'unico elenco.
// `main` è la voce principale (sempre la prima); `state` dice alla pagina di arrivo di aprire la sua finestra, una volta.
// Una voce in più costa una riga qui; il ventaglio la dispone da solo (fanLayout, da 2 a 5 voci in tutto).
// La bozza del Focus si rilegge a ogni render: chi mostra l'elenco si aggiorna quando si apre il menu o si cambia pagina.
export const useCenterActions = () => {
  const { t } = useTranslation();
  const measuresOn = useModule('body');
  const resume = hasFocusSessionInProgress();
  return [
    {
      key: 'start',
      main: true,
      label: t(resume ? 'focus.draft_resume' : 'focus.start'),
      shortLabel: t(resume ? 'nav.center.resume_short' : 'nav.center.start_short'),
      Icon: PlayArrowIcon,
      to: '/focus',
    },
    {
      key: 'record',
      label: t('nav.center.record'),
      shortLabel: t('nav.center.record_short'),
      Icon: EditCalendarOutlinedIcon,
      to: '/storico',
      state: { openRecord: true },
    },
    measuresOn && {
      key: 'measure',
      label: t('nav.center.measure'),
      shortLabel: t('nav.center.measure_short'),
      Icon: StraightenIcon,
      to: '/dashboard?tab=body',
      state: { openMeasure: true },
    },
  ].filter(Boolean);
};

export default useCenterActions;
