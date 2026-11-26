import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';

// Freccia «indietro» sulla riga del titolo di una sottopagina: un collegamento a icona con area da 44 px, la stessa altezza
// del blocco del titolo; `edge="start"` porta il disegno della freccia, e non il bordo dell'area, in asse col contenuto.
// `label` è il nome accessibile del collegamento: dice dove porta.
const BackArrow = ({ to, label }) => (
  <IconButton component={RouterLink} to={to} aria-label={label} edge="start" sx={{ width: 44, height: 44, color: 'text.primary' }}>
    <ArrowBackIcon />
  </IconButton>
);

export default BackArrow;
