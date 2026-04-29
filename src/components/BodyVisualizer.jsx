import React from 'react';
import { Box, Typography } from '@mui/material';
import Model from 'react-body-highlighter';

const BodyVisualizer = ({ recoveryData }) => {
  // Mappatura dei nostri gruppi muscolari sugli slug della libreria react-body-highlighter
  const muscleMapping = {
    petto: ['chest'],
    spalle: ['front-deltoids', 'back-deltoids'],
    addome: ['abs', 'obliques'],
    bicipiti: ['biceps'],
    tricipiti: ['triceps'],
    schiena: ['upper-back', 'lower-back', 'trapezius'],
    quadricipiti: ['quadriceps'],
    femorali: ['hamstring'],
    polpacci: ['calves'],
    glutei: ['gluteal']
  };

  // Converti lo stato in frequenza (intensity level) per la libreria
  // La libreria usa "frequency" per scegliere il colore dall'array highlightedColors
  const getFrequency = (mgKey) => {
    const data = recoveryData && recoveryData[mgKey];
    if (!data) return 0;
    if (data.status === 'PRONTO') return 1;
    if (data.status === 'IN RECUPERO') return 2;
    if (data.status === 'AFFATICATO') return 3;
    return 0;
  };

  // Prepara i dati nel formato atteso dalla libreria:
  // [{ name: string, muscles: string[], frequency: number }]
  const getBodyData = () => {
    const data = [];
    Object.keys(muscleMapping).forEach(myMg => {
      const frequency = getFrequency(myMg);
      if (frequency > 0) {
        data.push({
          name: myMg,
          muscles: muscleMapping[myMg],
          frequency: frequency
        });
      }
    });
    return data;
  };

  const bodyData = getBodyData();

  // Colori corrispondenti ai livelli di frequenza:
  // index 0 = frequency 1 (PRONTO), index 1 = frequency 2 (IN RECUPERO), index 2 = frequency 3 (AFFATICATO)
  const colors = ['#4caf50', '#ff9800', '#f44336'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Mappa Stato Muscolare
      </Typography>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: { xs: 1, sm: 4 }, 
        width: '100%', 
        maxWidth: '600px',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        py: 2
      }}>
        {/* Vista Frontale */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" display="block" color="text.secondary">Fronte</Typography>
          <Model 
            data={bodyData} 
            type="anterior"
            highlightedColors={colors}
          />
        </Box>

        {/* Vista Posteriore */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" display="block" color="text.secondary">Retro</Typography>
          <Model 
            data={bodyData} 
            type="posterior"
            highlightedColors={colors}
          />
        </Box>
      </Box>

      {/* Legenda */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#4caf50' }} />
          <Typography variant="caption">Pronto</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800' }} />
          <Typography variant="caption">In recupero</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f44336' }} />
          <Typography variant="caption">Affaticato</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#B6BDC3' }} />
          <Typography variant="caption">Nessun dato</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BodyVisualizer;
