import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

const BodyVisualizer = ({ recoveryData }) => {
  // Colori in base allo stato
  const getColor = (mg) => {
    const data = recoveryData && recoveryData[mg];
    if (!data) return '#e0e0e0'; // Grigio se non ci sono dati
    if (data.status === 'PRONTO') return '#4caf50'; // Verde
    if (data.status === 'IN RECUPERO') return '#ff9800'; // Arancio
    if (data.status === 'AFFATICATO') return '#f44336'; // Rosso
    return '#e0e0e0';
  };

  const getPercent = (mg) => {
    return recoveryData && recoveryData[mg] ? recoveryData[mg].percent : 0;
  };

  const renderMuscle = (id, label, path, mgKey) => (
    <Tooltip title={`${label}: ${getPercent(mgKey)}% (${recoveryData?.[mgKey]?.status || 'Sconosciuto'})`} arrow>
      <path
        id={id}
        d={path}
        fill={getColor(mgKey)}
        stroke="#fff"
        strokeWidth="1"
        style={{ transition: 'fill 0.3s ease', cursor: 'pointer' }}
      />
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Mappa Stato Muscolare
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, width: '100%', maxWidth: '500px' }}>
        {/* Vista Frontale (Semplificata) */}
        <svg viewBox="0 0 100 200" width="150" height="300">
          <title>Vista Frontale</title>
          {/* Testa */}
          <circle cx="50" cy="15" r="10" fill="#e0e0e0" />
          {/* Collo */}
          <rect x="47" y="25" width="6" height="5" fill="#e0e0e0" />
          
          {/* Petto */}
          {renderMuscle('petto-l', 'Petto', 'M 50 30 L 30 35 L 30 55 L 50 50 Z', 'petto')}
          {renderMuscle('petto-r', 'Petto', 'M 50 30 L 70 35 L 70 55 L 50 50 Z', 'petto')}
          
          {/* Spalle */}
          {renderMuscle('spalla-l', 'Spalle', 'M 30 35 L 20 40 L 25 55 L 30 55 Z', 'spalle')}
          {renderMuscle('spalla-r', 'Spalle', 'M 70 35 L 80 40 L 75 55 L 70 55 Z', 'spalle')}
          
          {/* Addome */}
          {renderMuscle('addome', 'Addome', 'M 35 55 L 65 55 L 60 85 L 40 85 Z', 'addome')}
          
          {/* Braccia (Bicipiti frontali) */}
          {renderMuscle('bicipite-l', 'Bicipiti', 'M 25 55 L 18 75 L 25 80 L 30 55 Z', 'bicipiti')}
          {renderMuscle('bicipite-r', 'Bicipiti', 'M 75 55 L 82 75 L 75 80 L 70 55 Z', 'bicipiti')}
          
          {/* Avambracci */}
          <path d="M 18 75 L 15 105 L 22 105 L 25 80 Z" fill="#e0e0e0" />
          <path d="M 82 75 L 85 105 L 78 105 L 75 80 Z" fill="#e0e0e0" />
          
          {/* Quadricipiti */}
          {renderMuscle('quad-l', 'Quadricipiti', 'M 35 85 L 48 90 L 45 140 L 30 140 Z', 'quadricipiti')}
          {renderMuscle('quad-r', 'Quadricipiti', 'M 65 85 L 52 90 L 55 140 L 70 140 Z', 'quadricipiti')}
          
          {/* Polpacci (Frontali) */}
          {renderMuscle('polp-f-l', 'Polpacci', 'M 30 150 L 42 150 L 40 190 L 32 190 Z', 'polpacci')}
          {renderMuscle('polp-f-r', 'Polpacci', 'M 70 150 L 58 150 L 60 190 L 68 190 Z', 'polpacci')}
          
          {/* Ginocchia */}
          <circle cx="37" cy="145" r="5" fill="#e0e0e0" />
          <circle cx="63" cy="145" r="5" fill="#e0e0e0" />
        </svg>

        {/* Vista Posteriore (Semplificata) */}
        <svg viewBox="0 0 100 200" width="150" height="300">
          <title>Vista Posteriore</title>
          <circle cx="50" cy="15" r="10" fill="#e0e0e0" />
          <rect x="47" y="25" width="6" height="5" fill="#e0e0e0" />
          
          {/* Schiena (Alta/Media) */}
          {renderMuscle('schiena-high', 'Schiena', 'M 50 30 L 25 40 L 35 60 L 50 65 L 65 60 L 75 40 Z', 'schiena')}
          {/* Schiena Bassa / Lombari */}
          {renderMuscle('schiena-low', 'Schiena', 'M 35 60 L 65 60 L 60 85 L 40 85 Z', 'schiena')}
          
          {/* Spalle Postariori */}
          {renderMuscle('spalla-p-l', 'Spalle', 'M 25 40 L 20 45 L 23 55 L 25 55 Z', 'spalle')}
          {renderMuscle('spalla-p-r', 'Spalle', 'M 75 40 L 80 45 L 77 55 L 75 55 Z', 'spalle')}
          
          {/* Tricipiti */}
          {renderMuscle('tricipite-l', 'Tricipiti', 'M 23 55 L 18 75 L 25 80 L 30 60 Z', 'tricipiti')}
          {renderMuscle('tricipite-r', 'Tricipiti', 'M 77 55 L 82 75 L 75 80 L 70 60 Z', 'tricipiti')}
          
          {/* Glutei */}
          {renderMuscle('glutei-l', 'Glutei', 'M 35 85 L 50 85 L 50 105 L 30 105 Z', 'glutei')}
          {renderMuscle('glutei-r', 'Glutei', 'M 65 85 L 50 85 L 50 105 L 70 105 Z', 'glutei')}
          
          {/* Femorali */}
          {renderMuscle('fem-l', 'Femorali', 'M 30 105 L 48 105 L 45 140 L 32 140 Z', 'femorali')}
          {renderMuscle('fem-r', 'Femorali', 'M 70 105 L 52 105 L 55 140 L 68 140 Z', 'femorali')}
          
          {/* Polpacci */}
          {renderMuscle('polp-l', 'Polpacci', 'M 32 150 L 45 150 L 42 190 L 35 190 Z', 'polpacci')}
          {renderMuscle('polp-r', 'Polpacci', 'M 68 150 L 55 150 L 58 190 L 65 190 Z', 'polpacci')}
        </svg>
      </Box>
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
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0' }} />
          <Typography variant="caption">Nessun dato</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BodyVisualizer;
