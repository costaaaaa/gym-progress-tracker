import { useState } from 'react';
import { Box, Button, Card, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import TimeZoneBadge from '../../components/TimeZoneBadge';
import { formatValue } from '../../components/ExerciseProgressRow';
import { formatDate, formatNumber } from '../../i18n/format';
import { kgToDisplay, kgToTotal, weightUnitLabel } from '../../utils/weightUnit';
import { positionLabel } from './exerciseText';

const ROWS_COLLAPSED = 5;
const HISTORY_TITLE_ID = 'exercise-history-title';

// Una coppia etichetta-valore della sessione: sotto sm quattro colonne non ci stanno (e la tabella scorrerebbe in
// orizzontale), quindi ogni sessione è una voce con la data in grassetto e sotto le coppie, che vanno a capo da sole.
const Pair = ({ label, children, strong = false }) => (
  <Box>
    <Box component="dt" sx={{ display: 'inline', mr: 0.75, fontSize: 16, color: 'text.secondary' }}>{label}</Box>
    <Box component="dd" sx={{ display: 'inline', m: 0, fontSize: 16, fontVariantNumeric: 'tabular-nums', ...(strong && { fontWeight: 700 }) }}>{children}</Box>
  </Box>
);

// La card «Cronologia» di un esercizio: le sessioni dalla più recente (le ultime 5, poi «Mostra tutti»), ognuna con la
// data (e il fuso, se diverso da quello del dispositivo, e la posizione nella seduta), la miglior serie, il valore con
// il segno PR e il volume totale. `item`: l'esercizio analizzato.
const ExerciseHistory = ({ item, weightUnit }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const rows = [...item.sessions].reverse();
  const visibleRows = showAll ? rows : rows.slice(0, ROWS_COLLAPSED);

  return (
    <Card component="section" aria-labelledby={HISTORY_TITLE_ID} sx={{ pb: rows.length > ROWS_COLLAPSED ? 1 : 0 }}>
      <Typography id={HISTORY_TITLE_ID} component="h2" variant="cardTitle" sx={{ px: 2.5, pt: 2, pb: 1 }}>{t('progress.history_title')}</Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {visibleRows.map((row, i) => {
          const position = positionLabel(t, row.position);
          return (
            // la stessa sessione può comparire due volte (esercizio ripetuto nella seduta): l'id da solo non basta
            <Box component="li" key={`${row.id}-${i}`} sx={{ px: 2.5, py: 1.5, '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' } }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Typography component="span" sx={{ fontSize: 16, fontWeight: 700 }}>{formatDate(row.date)}</Typography>
                <TimeZoneBadge workout={row} sx={{ fontSize: 16 }} />
                {position && (
                  <Chip size="small" variant="outlined" label={position} sx={{ fontSize: 16, borderColor: 'divider', color: 'text.secondary', fontWeight: 600 }} />
                )}
              </Box>
              <Box component="dl" sx={{ m: 0, mt: 0.5, display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 0.5 }}>
                <Pair label={t('progress.col.best_set')}>
                  {row.bestSet
                    ? (row.bestSet.weight > 0 ? `${formatNumber(kgToDisplay(row.bestSet.weight, weightUnit), { maximumFractionDigits: 2 })} × ${row.bestSet.reps}` : `${row.bestSet.reps} ${t('progress.unit.reps')}`)
                    : '—'}
                </Pair>
                <Pair label={t(`progress.kind.${item.mode}`)} strong>
                  {formatValue(t, item.mode, row.value, weightUnit)}{row.isPR && ` · ${t('progress.pr')}`}
                </Pair>
                <Pair label={t('progress.col.volume', { unit: weightUnitLabel(weightUnit) })}>{formatNumber(kgToTotal(row.volume, weightUnit))}</Pair>
              </Box>
            </Box>
          );
        })}
      </Box>
      {rows.length > ROWS_COLLAPSED && (
        <Box sx={{ textAlign: 'center' }}>
          <Button onClick={() => setShowAll(!showAll)} sx={{ minHeight: 44, fontSize: 16 }}>
            {showAll ? t('progress.show_less') : t('progress.show_all', { count: rows.length })}
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default ExerciseHistory;
