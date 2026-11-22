import { Typography } from '@mui/material';

// Variazione delle serie contro la settimana scorsa allo stesso punto: ▲ in verde, ▼ e = in grigio (qui più serie è un buon
// segno; il delta di ChartCard invece resta sempre grigio). Usata dalla card della settimana e da ogni riga per muscolo.
const Delta = ({ value }) => {
  if (value === 0) return <Typography component="span" sx={{ fontSize: 16, color: 'text.secondary' }}>=</Typography>;
  return (
    <Typography component="span" sx={{ fontSize: 16, fontWeight: 600, color: value > 0 ? 'success.main' : 'text.secondary' }}>
      {value > 0 ? `▲ ${value}` : `▼ ${-value}`}
    </Typography>
  );
};

export default Delta;
