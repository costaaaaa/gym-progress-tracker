import { Box, Card, Typography } from '@mui/material';
import WorkoutListItem from './WorkoutListItem';

// Una card di allenamenti: titolo h2 (che dà il nome alla sezione) e una riga-collegamento per allenamento. Serve all'elenco
// (un mese per card) e al calendario (il giorno scelto). `emptyText`: il testo da mostrare se non ce ne sono. `backTo`: dove
// tornerà la pagina dell'allenamento (vedi WorkoutListItem).
const WorkoutGroupCard = ({ id, title, workouts, summaries, weightUnit, backTo, emptyText }) => (
  <Card component="section" aria-labelledby={id} sx={{ mb: 3.5 }}>
    <Typography id={id} component="h2" variant="cardTitle" sx={{ px: 2.5, pt: 2, pb: 1 }}>{title}</Typography>
    {workouts.length > 0 ? (
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {workouts.map((workout) => (
          <WorkoutListItem key={workout.id} workout={workout} summary={summaries[workout.id]} weightUnit={weightUnit} backTo={backTo} />
        ))}
      </Box>
    ) : (
      <Typography sx={{ px: 2.5, pb: 2.5, fontSize: 16, color: 'text.secondary' }}>{emptyText}</Typography>
    )}
  </Card>
);

export default WorkoutGroupCard;
