import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  Box,
  Card,
  CardContent,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { API_BASE_URL } from '../config';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import itLocale from 'date-fns/locale/it';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StraightenIcon from '@mui/icons-material/Straighten';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';

const BodyStats = ({ isEmbedded = false }) => {
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    body_fat_percentage: '',
    muscle_mass_percentage: '',
    chest_size: '',
    arm_size: '',
    waist_size: '',
    leg_size: ''
  });

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/read.php`, {
        credentials: 'include'
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
        leg_size: formData.leg_size || null
      };

      const response = await fetch(`${API_BASE_URL}api/user_stats/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
        credentials: 'include'
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
          leg_size: ''
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
        credentials: 'include'
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Misurazione eliminata', severity: 'success' });
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting stat:', error);
    }
  };

  const formatChartData = (data) => {
    return data.map(item => ({
      ...item,
      dateFormatted: new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    }));
  };

  const chartData = formatChartData(stats);

  const renderContent = () => (
    <>
      {!isEmbedded && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Statistiche Fisiche
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setIsDialogOpen(true)}
            color="primary"
            sx={{ fontWeight: 'bold' }}
          >
            Nuova Misurazione
          </Button>
        </Box>
      )}

      {isEmbedded && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setIsDialogOpen(true)}
            color="primary"
          >
            Nuova Misurazione
          </Button>
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* ... (rest of grid content) */}
          {/* Grafico Peso */}
          <Grid item xs={12} md={6}>
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <MonitorWeightIcon sx={{ mr: 1, color: 'primary.main' }} /> Andamento Peso (kg)
                </Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.2)" />
                      <XAxis dataKey="dateFormatted" stroke="currentColor" fontSize={12} />
                      <YAxis domain={['auto', 'auto']} stroke="currentColor" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#fff' 
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        name="Peso (kg)" 
                        stroke="#d50000" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#d50000' }}
                        activeDot={{ r: 6 }} 
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Grafico Composizione Corporea */}
          <Grid item xs={12} md={6}>
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Composizione Corporea (%)</Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.2)" />
                      <XAxis dataKey="dateFormatted" stroke="currentColor" fontSize={12} />
                      <YAxis stroke="currentColor" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#fff' 
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="body_fat_percentage" name="Grasso (%)" stroke="#ff9800" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="muscle_mass_percentage" name="Muscolo (%)" stroke="#4caf50" strokeWidth={2} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Grafico Misure */}
          <Grid item xs={12}>
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <StraightenIcon sx={{ mr: 1, color: 'primary.main' }} /> Misure Corporee (cm)
                </Typography>
                <Box sx={{ height: 350, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.2)" />
                      <XAxis dataKey="dateFormatted" stroke="currentColor" fontSize={12} />
                      <YAxis stroke="currentColor" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: 'none', 
                          borderRadius: '8px',
                          color: '#fff' 
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="chest_size" name="Petto" stroke="#2196f3" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="arm_size" name="Braccio" stroke="#9c27b0" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="waist_size" name="Vita" stroke="#795548" strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="leg_size" name="Gamba" stroke="#607d8b" strokeWidth={2} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Tabella Storico */}
          <Grid item xs={12}>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead sx={{ bgcolor: (theme) => theme.palette.mode === 'light' ? '#f5f5f5' : 'rgba(255,255,255,0.05)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Data</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Peso</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Grasso %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Muscolo %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Petto</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Braccio</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Vita</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Gamba</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.slice().reverse().map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.date).toLocaleDateString('it-IT')}</TableCell>
                      <TableCell align="right">{row.weight || '-'}</TableCell>
                      <TableCell align="right">{row.body_fat_percentage || '-'}</TableCell>
                      <TableCell align="right">{row.muscle_mass_percentage || '-'}</TableCell>
                      <TableCell align="right">{row.chest_size || '-'}</TableCell>
                      <TableCell align="right">{row.arm_size || '-'}</TableCell>
                      <TableCell align="right">{row.waist_size || '-'}</TableCell>
                      <TableCell align="right">{row.leg_size || '-'}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">Nessuna misurazione registrata</TableCell>
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
        <DialogTitle sx={{ fontWeight: 'bold' }}>Aggiungi Misurazioni</DialogTitle>
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
              <TextField 
                label="Peso (kg)" 
                name="weight" 
                type="number" 
                fullWidth 
                value={formData.weight} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Grasso (%)" 
                name="body_fat_percentage" 
                type="number" 
                fullWidth 
                value={formData.body_fat_percentage} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Muscolo (%)" 
                name="muscle_mass_percentage" 
                type="number" 
                fullWidth 
                value={formData.muscle_mass_percentage} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField 
                label="Petto (cm)" 
                name="chest_size" 
                type="number" 
                fullWidth 
                value={formData.chest_size} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField 
                label="Braccio (cm)" 
                name="arm_size" 
                type="number" 
                fullWidth 
                value={formData.arm_size} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField 
                label="Vita (cm)" 
                name="waist_size" 
                type="number" 
                fullWidth 
                value={formData.waist_size} 
                onChange={handleInputChange} 
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField 
                label="Gamba (cm)" 
                name="leg_size" 
                type="number" 
                fullWidth 
                value={formData.leg_size} 
                onChange={handleInputChange} 
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsDialogOpen(false)}>Annulla</Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            color="primary"
            sx={{ fontWeight: 'bold' }}
          >
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
