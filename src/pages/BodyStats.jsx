import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Card,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { API_BASE_URL } from '../config';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ChartCard from '../components/ChartCard';

// Serie per il grafico "Composizione Corporea" e "Circonferenze": chiave dato, etichetta, colore.
const BODY_COMPOSITION_SERIES = [
  { key: 'body_fat_percentage', label: 'Grasso', color: '#4f46e5', unit: '%' },
  { key: 'muscle_mass_percentage', label: 'Muscolo', color: '#16a34a', unit: '%' },
];
const CIRCUMFERENCE_SERIES = [
  { key: 'chest_size', label: 'Torace', color: '#d50000', unit: 'cm' },
  { key: 'waist_size', label: 'Vita', color: '#d97706', unit: 'cm' },
  { key: 'arm_size', label: 'Braccio', color: '#4f46e5', unit: 'cm' },
  { key: 'leg_size', label: 'Gamba', color: '#7c3aed', unit: 'cm' },
];

const lastValueOf = (data, key) => {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][key] !== null && data[i][key] !== undefined && data[i][key] !== '') return data[i][key];
  }
  return null;
};

// Mini grafico multi-serie senza assi, usato dalle card "Composizione Corporea" e "Circonferenze".
const MiniMultiLineChart = ({ data, series }) => (
  <Box sx={{ height: 90 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </Box>
);

const MiniChartLegend = ({ data, series }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5 }}>
    {series.map((s) => {
      const value = lastValueOf(data, s.key);
      return (
        <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {s.label}: <strong>{value !== null ? `${value}${s.unit}` : '—'}</strong>
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const numberFieldSx = {
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
  '& input[type=number]': { MozAppearance: 'textfield' },
};

const BodyStats = ({ isEmbedded = false }) => {
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    body_fat_percentage: '',
    muscle_mass_percentage: '',
    chest_size: '',
    arm_size: '',
    waist_size: '',
    leg_size: '',
  });

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/read.php`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.records) {
        setStats(data.records);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setSnackbar({ open: true, message: 'Errore nel caricamento delle statistiche', severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, date });
  };

  const handleSubmit = async () => {
    try {
      const formattedData = {
        ...formData,
        date: formData.date.toISOString().split('T')[0],
        weight: formData.weight || null,
        body_fat_percentage: formData.body_fat_percentage || null,
        muscle_mass_percentage: formData.muscle_mass_percentage || null,
        chest_size: formData.chest_size || null,
        arm_size: formData.arm_size || null,
        waist_size: formData.waist_size || null,
        leg_size: formData.leg_size || null,
      };

      const response = await fetch(`${API_BASE_URL}api/user_stats/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
        credentials: 'include',
      });

      const result = await response.json();
      if (response.ok) {
        setSnackbar({ open: true, message: 'Statistiche salvate con successo', severity: 'success' });
        setIsDialogOpen(false);
        setFormData({
          date: new Date(),
          weight: '',
          body_fat_percentage: '',
          muscle_mass_percentage: '',
          chest_size: '',
          arm_size: '',
          waist_size: '',
          leg_size: '',
        });
        fetchStats();
      } else {
        setSnackbar({ open: true, message: result.message || 'Errore nel salvataggio', severity: 'error' });
      }
    } catch (error) {
      console.error('Error saving stats:', error);
      setSnackbar({ open: true, message: 'Errore di connessione', severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa misurazione?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include',
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Misurazione eliminata', severity: 'success' });
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting stat:', error);
    }
  };

  const chartData = stats.map(item => ({
    ...item,
    dateFormatted: new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
  }));

  const weightSeries = chartData.map(d => d.weight).filter(v => v !== null && v !== undefined);
  const lastWeight = lastValueOf(chartData, 'weight');
  const firstWeight = weightSeries[0];
  const weightDelta = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  const renderContent = () => (
    <>
      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Statistiche Fisiche
          </Typography>
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsDialogOpen(true)}>
          Nuova Misurazione
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Andamento Peso — a piena larghezza */}
          <Grid item xs={12}>
            <ChartCard
              title="Andamento Peso (kg)"
              data={weightSeries}
              color="primary.main"
              valueLabel={lastWeight !== null ? `${lastWeight} kg` : '—'}
              deltaUp={weightDelta !== null ? weightDelta >= 0 : true}
              deltaText={weightDelta !== null ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} kg dalla prima rilevazione` : undefined}
            />
          </Grid>

          {/* Composizione Corporea */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: '22px' }}>
              <Typography sx={{ textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                Composizione Corporea (%)
              </Typography>
              <MiniMultiLineChart data={chartData} series={BODY_COMPOSITION_SERIES} />
              <MiniChartLegend data={chartData} series={BODY_COMPOSITION_SERIES} />
            </Card>
          </Grid>

          {/* Circonferenze */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: '22px' }}>
              <Typography sx={{ textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                Circonferenze (cm)
              </Typography>
              <MiniMultiLineChart data={chartData} series={CIRCUMFERENCE_SERIES} />
              <MiniChartLegend data={chartData} series={CIRCUMFERENCE_SERIES} />
            </Card>
          </Grid>

          {/* Tabella Storico */}
          <Grid item xs={12}>
            <TableContainer component={Card} sx={{ p: 0 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Data</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Peso</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Grasso %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Muscolo %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Petto</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Braccio</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Vita</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Gamba</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.slice().reverse().map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ fontSize: 13 }}>{new Date(row.date).toLocaleDateString('it-IT')}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13, fontWeight: 700 }}>{row.weight || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.body_fat_percentage || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.muscle_mass_percentage || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.chest_size || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.arm_size || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.waist_size || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{row.leg_size || '-'}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>Nessuna misurazione registrata</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}
    </>
  );

  return (
    <>
      {isEmbedded ? (
        <Box sx={{ mt: 2 }}>{renderContent()}</Box>
      ) : (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>{renderContent()}</Container>
      )}

      {/* Dialog Nuova Misurazione */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Aggiungi Misurazioni</DialogTitle>
        <DialogContent dividers>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={itLocale}>
            <DatePicker
              label="Data"
              value={formData.date}
              onChange={handleDateChange}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 3, mt: 1 } } }}
            />
          </LocalizationProvider>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="Peso (kg)" name="weight" type="number" fullWidth value={formData.weight} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Grasso (%)" name="body_fat_percentage" type="number" fullWidth value={formData.body_fat_percentage} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Muscolo (%)" name="muscle_mass_percentage" type="number" fullWidth value={formData.muscle_mass_percentage} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Petto (cm)" name="chest_size" type="number" fullWidth value={formData.chest_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Braccio (cm)" name="arm_size" type="number" fullWidth value={formData.arm_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Vita (cm)" name="waist_size" type="number" fullWidth value={formData.waist_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Gamba (cm)" name="leg_size" type="number" fullWidth value={formData.leg_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsDialogOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Salva
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BodyStats;
