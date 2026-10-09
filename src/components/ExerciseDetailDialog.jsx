import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '../i18n/format';
import { muscleLabel } from '../i18n/labels';
import { formatValue } from './ExerciseProgressCard';

const HEAD_SX = { fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, border: 0, px: { xs: 0.75, sm: 2 }, lineHeight: 1.2, verticalAlign: 'bottom' };
const ROWS_COLLAPSED = 5;

const PRDot = ({ cx, cy, payload, color }) => {
  if (cx === undefined || cy === undefined) return null;
  return payload.isPR
    ? <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />
    : <circle cx={cx} cy={cy} r={3} fill={color} />;
};

const ChartTooltip = ({ active, payload, mode, t }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>{p.dateLabel}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {t(`progress.kind.${mode}`)}: <strong>{formatValue(t, mode, p.value)}</strong>
        {p.isPR && ` · ${t('progress.pr')}`}
      </Typography>
    </Box>
  );
};

const Stat = ({ label, value }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</Typography>
    <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 20 }}>{value}</Typography>
  </Box>
);

const ExerciseDetailDialog = ({ item, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [showAll, setShowAll] = useState(false);

  const open = Boolean(item);
  const sessions = item?.sessions || [];
  const chartData = sessions.map((s) => ({ ...s, dateLabel: formatDate(s.date) }));
  const rows = [...chartData].reverse();
  const visibleRows = showAll ? rows : rows.slice(0, ROWS_COLLAPSED);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} TransitionProps={{ onExited: () => setShowAll(false) }}>
      {item && (
        <>
          <DialogTitle sx={{ pr: 6 }}>
            <Typography component="span" sx={{ display: 'block', fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 18 }}>{item.name}</Typography>
            <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary', fontWeight: 400 }}>{muscleLabel(item.muscle)}</Typography>
            <IconButton aria-label={t('progress.close')} onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Stat label={t('progress.detail.current')} value={formatValue(t, item.mode, item.last.value)} />
              <Stat label={t('progress.detail.best')} value={formatValue(t, item.mode, item.best)} />
              <Stat label={t('progress.detail.sessions')} value={sessions.length} />
            </Box>

            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{t(`progress.kind.${item.mode}`)}</Typography>
            {item.skipped > 0 && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{t('progress.skipped_sessions', { count: item.skipped })}</Typography>
            )}
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid horizontal vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="dateLabel" fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} tickCount={4} width={40} domain={[(min) => Math.floor(min - 2), (max) => Math.ceil(max + 2)]} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip mode={item.mode} t={t} />} />
                  <Line type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={<PRDot color={theme.palette.primary.main} />} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 15, mt: 3, mb: 1 }}>{t('progress.history_title')}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_SX}>{t('progress.col.date')}</TableCell>
                    <TableCell align="right" sx={HEAD_SX}>{t('progress.col.best_set')}</TableCell>
                    <TableCell align="right" sx={HEAD_SX}>{t(`progress.kind.${item.mode}`)}</TableCell>
                    <TableCell align="right" sx={HEAD_SX}>{t('progress.col.volume')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row, i) => {
                    const cellSx = { fontSize: { xs: 12, sm: 13 }, px: { xs: 0.75, sm: 2 }, whiteSpace: 'nowrap', borderColor: 'divider', ...(i === visibleRows.length - 1 ? { border: 0 } : {}) };
                    return (
                      <TableRow key={row.id}>
                        <TableCell sx={cellSx}>{row.dateLabel}</TableCell>
                        <TableCell align="right" sx={cellSx}>
                          {row.bestSet
                            ? (row.bestSet.weight > 0 ? `${formatNumber(row.bestSet.weight, { maximumFractionDigits: 2 })} × ${row.bestSet.reps}` : `${row.bestSet.reps} ${t('progress.unit.reps')}`)
                            : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>
                          {formatValue(t, item.mode, row.value)}{row.isPR && ` · ${t('progress.pr')}`}
                        </TableCell>
                        <TableCell align="right" sx={{ ...cellSx, color: 'text.secondary' }}>{formatNumber(row.volume)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {rows.length > ROWS_COLLAPSED && (
              <Box sx={{ textAlign: 'center', mt: 1 }}>
                <Button size="small" onClick={() => setShowAll(!showAll)} sx={{ fontSize: 13 }}>
                  {showAll ? t('progress.show_less') : t('progress.show_all', { count: rows.length })}
                </Button>
              </Box>
            )}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default ExerciseDetailDialog;
