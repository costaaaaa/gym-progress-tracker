// Editor delle serie pianificate di un esercizio (#77). Forma compatta (serie, riscaldamento,
// ripetizioni, tecnica sull'ultima) oppure per serie ("Serie diverse"). Emette planned_sets,
// o null finché un campo non è valido; il valore iniziale si legge solo al montaggio.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, IconButton, InputLabel,
  MenuItem, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, RemoveCircleOutline as RemoveIcon } from '@mui/icons-material';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE, techniqueLabel } from '../i18n/labels';
import { MAX_WORKING } from '../utils/plannedSets';
import {
  addRow, draftErrors, draftFromPlannedSets, draftToCompact, draftToList, plannedSetsFromDraft, removeRow,
} from '../utils/plannedSetsDraft';

const numeric = { inputMode: 'numeric' };

const TechniqueSelect = ({ id, label, value, onChange, helperText, size }) => (
  <FormControl fullWidth size={size}>
    <InputLabel id={`${id}-label`}>{label}</InputLabel>
    <Select labelId={`${id}-label`} id={id} value={value} label={label} onChange={(e) => onChange(e.target.value)}>
      {INTENSITY_TECHNIQUES.map((tech) => (
        <MenuItem key={tech} value={tech === NO_TECHNIQUE ? '' : tech}>{techniqueLabel(tech)}</MenuItem>
      ))}
    </Select>
    {helperText && <FormHelperText>{helperText}</FormHelperText>}
  </FormControl>
);

const PlannedSetsEditor = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => draftFromPlannedSets(value));
  const planned = useMemo(() => plannedSetsFromDraft(draft), [draft]);
  useEffect(() => { onChange(planned); }, [planned, onChange]);

  const errors = draftErrors(draft);
  const compactDraft = draft.list ? draftToCompact(draft) : null;
  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const patchRow = (changes) => setDraft((d) => ({ ...d, row: { ...d.row, ...changes } }));
  const patchRows = (index, changes) => setDraft((d) => ({
    ...d, rows: d.rows.map((row, i) => (i === index ? { ...row, ...changes } : row)),
  }));
  // L'errore si mostra solo su un campo già compilato: un modulo nuovo non parte in rosso.
  const shown = (text, key) => (String(text).trim() !== '' && key ? t(key) : '');

  const toggleList = () => {
    if (!draft.list) setDraft(draftToList(draft));
    else if (compactDraft) setDraft(compactDraft);
  };

  const warmupsField = (
    <TextField
      label={t('plan_editor.warmups')}
      value={draft.warmups}
      onChange={(e) => patch({ warmups: e.target.value })}
      error={Boolean(errors.warmups)}
      helperText={shown(draft.warmups, errors.warmups)}
      inputProps={numeric}
      fullWidth
    />
  );

  return (
    <Stack spacing={2}>
      <Box>
        <FormControlLabel
          control={<Switch checked={draft.list} onChange={toggleList} disabled={draft.list && !compactDraft} />}
          label={t('plan_editor.different_sets')}
        />
        {draft.list && !compactDraft && (
          <FormHelperText sx={{ mt: 0, ml: 0 }}>{t('plan_editor.different_sets_note')}</FormHelperText>
        )}
      </Box>

      {!draft.list ? (
        <>
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('plan_editor.sets')}
              value={draft.sets}
              onChange={(e) => patch({ sets: e.target.value })}
              error={Boolean(errors.sets)}
              helperText={shown(draft.sets, errors.sets)}
              inputProps={numeric}
              fullWidth
            />
            {warmupsField}
          </Stack>
          <TextField
            label={t(draft.row.to_failure ? 'plan_editor.min' : 'plan_editor.reps')}
            value={draft.row.target}
            onChange={(e) => patchRow({ target: e.target.value })}
            error={Boolean(errors.target)}
            helperText={shown(draft.row.target, errors.target)}
            inputProps={numeric}
            fullWidth
          />
          <FormControlLabel
            control={<Checkbox checked={draft.row.to_failure} onChange={(e) => patchRow({ to_failure: e.target.checked, target: '' })} />}
            label={t('plan_editor.to_failure')}
          />
          <TechniqueSelect
            id="planned-sets-technique"
            label={t('plan_editor.technique')}
            value={draft.row.technique}
            onChange={(technique) => patchRow({ technique })}
            helperText={t('plan_editor.technique_note')}
          />
        </>
      ) : (
        <>
          {warmupsField}
          {draft.rows.map((row, index) => (
            <Box
              key={index}
              role="group"
              aria-label={t('plan_editor.set_n', { n: index + 1 })}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">{t('plan_editor.set_n', { n: index + 1 })}</Typography>
                <IconButton
                  size="small"
                  aria-label={t('plan_editor.remove_set')}
                  disabled={draft.rows.length <= 1}
                  onClick={() => setDraft((d) => removeRow(d, index))}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small"
                    label={t(row.to_failure ? 'plan_editor.min' : 'plan_editor.target')}
                    value={row.target}
                    onChange={(e) => patchRows(index, { target: e.target.value })}
                    error={Boolean(errors.rows[index])}
                    helperText={shown(row.target, errors.rows[index])}
                    inputProps={numeric}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={row.to_failure} onChange={(e) => patchRows(index, { to_failure: e.target.checked, target: '' })} />}
                    label={t('plan_editor.to_failure')}
                    sx={{ flexShrink: 0, mr: 0, height: 40, whiteSpace: 'nowrap' }}
                  />
                </Stack>
                <TechniqueSelect
                  id={`planned-sets-technique-${index}`}
                  size="small"
                  label={t('plan_editor.technique_short')}
                  value={row.technique}
                  onChange={(technique) => patchRows(index, { technique })}
                />
              </Stack>
            </Box>
          ))}
          {draft.rows.length < MAX_WORKING && (
            <Button startIcon={<AddIcon />} onClick={() => setDraft((d) => addRow(d))} sx={{ alignSelf: 'flex-start' }}>
              {t('plan_editor.add_set')}
            </Button>
          )}
        </>
      )}
    </Stack>
  );
};

export default PlannedSetsEditor;
