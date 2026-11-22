import { IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { lengthUnitLabel } from '../../utils/lengthUnit';
import { weightUnitLabel } from '../../utils/weightUnit';
import StatValue from './StatValue';

const headCellSx = { fontWeight: 600, fontSize: 16, color: 'text.secondary' };
const bodyCellSx = { fontSize: 16, fontVariantNumeric: 'tabular-nums' };

// Storico da tablet in su: una riga per misurazione
const HistoryTable = ({ rows, empty, onDelete, weightUnit }) => {
  const { t } = useTranslation();
  return (
    <Table size="small" aria-label={t('body.history_aria')}>
      <TableHead>
        <TableRow>
          <TableCell sx={headCellSx}>{t('body.col.date')}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.weight_kg', { unit: weightUnitLabel(weightUnit) })}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.fat')}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.muscle')}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.length', { label: t('body.chest'), unit: lengthUnitLabel(weightUnit) })}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.length', { label: t('body.arm'), unit: lengthUnitLabel(weightUnit) })}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.length', { label: t('body.waist'), unit: lengthUnitLabel(weightUnit) })}</TableCell>
          <TableCell align="right" sx={headCellSx}>{t('body.col.length', { label: t('body.leg'), unit: lengthUnitLabel(weightUnit) })}</TableCell>
          <TableCell align="center" sx={headCellSx}>{t('body.col.actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell sx={bodyCellSx}>{formatDate(row.date)}</TableCell>
            <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}><StatValue row={row} field="weight" weightUnit={weightUnit} /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="body_fat_percentage" /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="muscle_mass_percentage" /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="chest_size" weightUnit={weightUnit} /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="arm_size" weightUnit={weightUnit} /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="waist_size" weightUnit={weightUnit} /></TableCell>
            <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="leg_size" weightUnit={weightUnit} /></TableCell>
            <TableCell align="center">
              <IconButton size="small" aria-label={t('common.delete')} onClick={() => onDelete(row.id)} sx={{ color: 'text.secondary' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
        {empty && (
          <TableRow>
            <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3, fontSize: 16 }}>{t('body.empty')}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default HistoryTable;
