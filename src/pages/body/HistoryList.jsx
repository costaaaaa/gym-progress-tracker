import { Fragment } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { weightUnitLabel } from '../../utils/weightUnit';
import HealthMark from './HealthMark';
import StatValue from './StatValue';
import { HISTORY_SERIES, hasValue, isFromHealth, measureText } from './series';

// Storico sul telefono: data e peso sulla prima linea, le altre misure in grigio sulla seconda
const HistoryList = ({ rows, empty, onDelete, weightUnit }) => {
  const { t } = useTranslation();
  if (empty) {
    return <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center', fontSize: 16 }}>{t('body.empty')}</Typography>;
  }
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {rows.map((row) => {
        const others = HISTORY_SERIES.filter((s) => hasValue(row[s.key]));
        return (
          <Box component="li" key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 0.5, py: 0.75, '& + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: 16 }}>{formatDate(row.date)}</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {/* Numero (con il cuore di Salute) e unità sono pezzi separati: lo spazio non separabile e l'unità si scrivono a mano */}
                  {row.weight ? <><StatValue row={row} field="weight" weightUnit={weightUnit} />{' '}{weightUnitLabel(weightUnit)}</> : '-'}
                </Typography>
              </Box>
              {others.length > 0 && (
                <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                  {others.map((s, i) => (
                    <Fragment key={s.key}>
                      {i > 0 && ' · '}{t(s.label)} {measureText(s, row[s.key], weightUnit)}{isFromHealth(row, s.key) && <HealthMark />}
                    </Fragment>
                  ))}
                </Typography>
              )}
            </Box>
            <IconButton aria-label={t('common.delete')} onClick={() => onDelete(row.id)} sx={{ width: 44, height: 44, color: 'text.secondary' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
};

export default HistoryList;
