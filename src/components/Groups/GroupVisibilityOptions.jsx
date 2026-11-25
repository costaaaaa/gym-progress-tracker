import { useState } from 'react';
import { Box, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useModule } from '../../hooks/useModule';
import { isGroupShown, useSaveGroupVisibility } from '../../hooks/useGroupVisibility';
import { SWITCH_SLOT } from '../../utils/switchStyles';

const OPTIONS = ['workouts', 'volume', 'streak', 'level'];

// Le quattro opzioni «Cosa mostro» dell'account, valide per tutti i gruppi: una riga con interruttore ciascuna, il cambio
// si salva subito. `notify(messaggio, gravità)` annuncia l'esito (e mostra l'errore). Le dipendenze sono solo di
// visualizzazione: i valori salvati non cambiano. Volume vale con gli allenamenti, streak e livello col modulo Livelli.
const GroupVisibilityOptions = ({ notify, idPrefix = 'groups-shown' }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const save = useSaveGroupVisibility();
  const levelsActive = useModule('levels');
  // Opzioni con un salvataggio in corso, col valore atteso: l'interruttore lo mostra subito
  const [pending, setPending] = useState({});

  const stored = (key) => pending[key] ?? isGroupShown(user, key);
  const lockedBy = (key) => {
    if (key === 'volume' && !stored('workouts')) return 'volume';
    if ((key === 'streak' || key === 'level') && !levelsActive) return 'levels';
    return null;
  };

  const toggle = async (key, next) => {
    // Mentre il salvataggio è in corso un altro cambio della stessa opzione è ignorato (il fuoco resta sull'interruttore)
    if (key in pending) return;
    setPending((p) => ({ ...p, [key]: next }));
    const res = await save({ [key]: next });
    if (res.ok) {
      notify(t('groups.shown.changed', { name: t(`groups.shown.${key}.name`), state: t(next ? 'groups.shown.on' : 'groups.shown.off') }), 'success');
    } else {
      notify(t('groups.shown.save_error'), 'error');
    }
    setPending((p) => {
      const rest = { ...p };
      delete rest[key];
      return rest;
    });
  };

  return (
    <Box>
      <Typography id={`${idPrefix}-reciprocity`} sx={{ fontSize: 16, color: 'text.secondary', mb: 0.5, maxWidth: 560 }}>
        {t('groups.shown.reciprocity')}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {OPTIONS.map((key, index) => {
          const lock = lockedBy(key);
          const on = !lock && stored(key);
          const helpId = `${idPrefix}-${key}-help`;
          const reasonId = lock === 'levels' ? `${idPrefix}-levels-off` : `${idPrefix}-${key}-reason`;
          return (
            <Box component="li" key={key} sx={{ py: 1.25, borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t(`groups.shown.${key}.name`)}</Typography>
                  <Typography id={helpId} sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }}>{t(`groups.shown.${key}.help`)}</Typography>
                  {lock === 'volume' && (
                    <Typography id={reasonId} sx={{ fontSize: 16, mt: 0.25 }}>{t('groups.shown.volume_needs_workouts')}</Typography>
                  )}
                </Box>
                <Box component="label" sx={SWITCH_SLOT}>
                  <Switch
                    checked={on}
                    disabled={lock !== null}
                    onChange={(e) => toggle(key, e.target.checked)}
                    inputProps={{ role: 'switch', 'aria-label': t(`groups.shown.${key}.name`), 'aria-busy': key in pending, 'aria-describedby': lock ? reasonId : helpId }}
                  />
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {!levelsActive && (
        <Typography id={`${idPrefix}-levels-off`} sx={{ fontSize: 16, mt: 0.5 }}>{t('groups.shown.levels_off', { name: t('modules.levels.name') })}</Typography>
      )}
    </Box>
  );
};

export default GroupVisibilityOptions;
