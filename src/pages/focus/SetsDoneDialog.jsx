import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { focusFieldSx } from './focusField';
import { slotLabel } from './slotLabel';
import TechniqueRow from './TechniqueRow';
import RepsConfirmDialog from './RepsConfirmDialog';
import { MAX_WEIGHT, isValidReps, plannedSetAt, repsNeedConfirm, setSlot } from '../../utils/focusSession';
import { fieldToKg, maxWeightInUnit, weightStepInUnit, weightToField, weightUnitLabel } from '../../utils/weightUnit';
import { formatSetText } from '../../i18n/format';
import { techniqueLabel } from '../../i18n/labels';
import { radius } from '../../theme/radius';

// Correzione di una serie fatta: peso, ripetizioni e tecnica (questa solo nelle allenanti e con lo strumento acceso).
// Il peso parte dai kg salvati nell'unità dell'utente; se non si tocca il campo i kg restano quelli salvati.
function SetEditForm({ exercise, set, weightUnit, techniqueOn, onSave, onCancel }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const slot = setSlot(exercise, set.setNumber - 1);
  const [origin] = useState(() => {
    const text = weightToField(String(set.weight), weightUnit);
    return { text, kg: String(set.weight) };
  });
  const [weight, setWeight] = useState(origin.text);
  const [reps, setReps] = useState(String(set.reps));
  const [technique, setTechnique] = useState(set.intensity_technique || '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const weightRef = useRef(null);
  useEffect(() => { weightRef.current?.focus(); }, []);

  const weightKg = fieldToKg(weight, weightUnit, MAX_WEIGHT, origin);
  const valid = weightKg !== null && isValidReps(reps);
  const commit = () => {
    setConfirmOpen(false);
    onSave({ weight: weightKg, reps, intensity_technique: technique });
  };
  const save = () => {
    if (!valid) return;
    if (repsNeedConfirm(reps, plannedSetAt(exercise, set.setNumber - 1))) setConfirmOpen(true);
    else commit();
  };
  const fieldSx = focusFieldSx(colors, '1.1rem');
  return (
    <Box role="group" aria-label={t('focus.edit_set.group', { name: slotLabel(t, slot, 'name') })} sx={{ py: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField label={t('record.weight', { unit: weightUnitLabel(weightUnit) })} type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
          fullWidth inputRef={weightRef} sx={fieldSx}
          inputProps={{ step: weightStepInUnit(weightUnit), min: 0, max: maxWeightInUnit(MAX_WEIGHT, weightUnit), inputMode: 'decimal' }} />
        <TextField label={t('record.reps')} value={reps} onChange={(e) => setReps(e.target.value)} onFocus={(e) => e.target.select()}
          fullWidth sx={fieldSx} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} />
      </Box>
      {!slot.isWarmup && techniqueOn && <TechniqueRow value={technique} onChange={setTechnique} columns={2} />}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} sx={{ color: colors.textSecondary, minHeight: 44 }}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!valid}
          sx={{ minHeight: 44, bgcolor: colors.primary, color: colors.primaryContrast, boxShadow: 'none', '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            '&:disabled': { bgcolor: colors.bgElevated, color: colors.textSecondary } }}>
          {t('common.save')}
        </Button>
      </Box>
      <RepsConfirmDialog open={confirmOpen} reps={reps} onClose={() => setConfirmOpen(false)} onConfirm={commit} />
    </Box>
  );
}

// Le serie fatte dell'esercizio (le saltate non ci sono), nell'ordine in cui sono state fatte; una alla volta si apre
// in modifica. L'esito si legge qui dentro: la pagina dietro la finestra è nascosta ai lettori di schermo.
// È separato dalla finestra perché si smonta con lei: a ogni apertura riga in modifica e messaggio ripartono da capo.
function SetsDoneContent({ exercise, sets, weightUnit, techniqueOn, onEditSet, startEditing, onClose }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const [editing, setEditing] = useState(startEditing ?? null);
  const [message, setMessage] = useState('');
  const rowRefs = useRef({});
  // Chiusa la modifica (Salva o Annulla) il fuoco torna alla riga di quella serie
  const returnTo = useRef(null);
  useEffect(() => {
    if (editing === null && returnTo.current !== null) {
      rowRefs.current[returnTo.current]?.focus();
      returnTo.current = null;
    }
  }, [editing]);

  const open = (setNumber) => {
    // La regione riparte vuota a ogni modifica: lo stesso esito di prima verrebbe riletto
    setMessage('');
    setEditing(setNumber);
  };
  const close = (setNumber) => {
    returnTo.current = setNumber;
    setEditing(null);
  };
  const save = (set, changes) => {
    onEditSet(exercise.id, set.setNumber, changes);
    setMessage(t('focus.edit_set.done'));
    close(set.setNumber);
  };

  return (
    <>
      <DialogTitle id="sets-done-title" sx={{ color: colors.text }}>{t('focus.done_sets.title')}</DialogTitle>
      <DialogContent>
        {sets.length === 0 ? (
          <Typography sx={{ color: colors.textSecondary }}>{t('focus.done_sets.empty')}</Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>{t('focus.done_sets.help')}</Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {sets.map((set) => (
                <Box component="li" key={set.setNumber} sx={{ borderTop: `1px solid ${colors.border}` }}>
                  {editing === set.setNumber ? (
                    <SetEditForm exercise={exercise} set={set} weightUnit={weightUnit} techniqueOn={techniqueOn}
                      onSave={(changes) => save(set, changes)} onCancel={() => close(set.setNumber)} />
                  ) : (
                    <ButtonBase onClick={() => open(set.setNumber)} ref={(el) => { rowRefs.current[set.setNumber] = el; }} sx={{
                      width: '100%', minHeight: 44, py: 1, px: 0.5, borderRadius: radius.sm, justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', gap: 2,
                    }}>
                      {/* setNumber è la posizione (da 1) della serie: si mostra il numero dentro il suo tipo */}
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>{slotLabel(t, setSlot(exercise, set.setNumber - 1), 'name')}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatSetText(set.weight, set.reps, weightUnit)}</Typography>
                        {set.intensity_technique && (
                          <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>{techniqueLabel(set.intensity_technique)}</Typography>
                        )}
                      </Box>
                    </ButtonBase>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}
        {/* Sempre nel DOM, ma vuota non occupa spazio */}
        <Typography role="status" variant="body2" sx={{ color: colors.text, mt: message ? 1 : 0 }}>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: colors.text, minHeight: 44 }}>{t('common.close')}</Button>
      </DialogActions>
    </>
  );
}

export default function SetsDoneDialog({ open, onClose, ...content }) {
  const { colors } = useFocusColors();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="sets-done-title"
      PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: radius.xxl } }}>
      <SetsDoneContent {...content} onClose={onClose} />
    </Dialog>
  );
}
