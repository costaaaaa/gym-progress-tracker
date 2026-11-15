import { CircularProgress } from '@mui/material';

// Rotellina nel bottone mentre salva: il bottone resta disabilitato e porta il testo,
// quindi la rotellina è solo decorativa (nascosta agli screen reader).
const ButtonSpinner = ({ size = 20, sx }) => <CircularProgress aria-hidden size={size} sx={sx} />;

export default ButtonSpinner;
