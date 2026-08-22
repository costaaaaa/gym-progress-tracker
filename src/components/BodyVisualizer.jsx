import React from 'react';
import { Box, Typography } from '@mui/material';

// Gruppi muscolari tracciati e relativa etichetta italiana (stesse chiavi usate da
// dashboardStats.recovery restituito da api/workout_stats/dashboard.php).
const MUSCLE_GROUPS = [
  { key: 'petto', label: 'Petto' },
  { key: 'schiena', label: 'Schiena' },
  { key: 'spalle', label: 'Spalle' },
  { key: 'bicipiti', label: 'Bicipiti' },
  { key: 'tricipiti', label: 'Tricipiti' },
  { key: 'addome', label: 'Addome' },
  { key: 'quadricipiti', label: 'Quadricipiti' },
  { key: 'femorali', label: 'Femorali' },
  { key: 'glutei', label: 'Glutei' },
  { key: 'polpacci', label: 'Polpacci' },
];

// Stato grezzo dal backend ("PRONTO" / "IN RECUPERO" / "AFFATICATO") → etichetta capitalizzata + colore.
const STATUS_META = {
  PRONTO: { label: 'Pronto', color: 'success.main' },
  'IN RECUPERO': { label: 'In recupero', color: 'warning.main' },
  AFFATICATO: { label: 'Affaticato', color: 'error.main' },
};

// Righe di una colonna della lista: nome a sinistra, stato a destra.
const MuscleRow = ({ group, recoveryData }) => {
  const status = recoveryData?.[group.key]?.status;
  const meta = STATUS_META[status];
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{group.label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: meta ? meta.color : 'text.disabled' }}>
        {meta ? meta.label : 'Nessun dato'}
      </Typography>
    </Box>
  );
};

const BodyVisualizer = ({ recoveryData }) => {
  const half = Math.ceil(MUSCLE_GROUPS.length / 2);
  const leftColumn = MUSCLE_GROUPS.slice(0, half);
  const rightColumn = MUSCLE_GROUPS.slice(half);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
        Stato Muscolare
      </Typography>

      {/* Due liste separate da un divisore verticale, per evitare l'ambiguità della griglia
          implicita (dove non era chiaro quali righe appartenessero a quale colonna). */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {leftColumn.map((group) => (
            <MuscleRow key={group.key} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
        <Box sx={{ width: '1px', bgcolor: 'divider', flexShrink: 0 }} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {rightColumn.map((group) => (
            <MuscleRow key={group.key} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default BodyVisualizer;
