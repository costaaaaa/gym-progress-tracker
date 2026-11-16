import { InputAdornment, IconButton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

// Occhio «mostra/nascondi» in fondo a un campo password.
// Il clic non toglie il focus al campo: non è un'uscita (in Safari il pulsante non prende il focus)
const PasswordToggle = ({ shown, onToggle, label, disabled }) => {
  return (
    <InputAdornment position="end">
      <IconButton aria-label={label} onClick={onToggle} onMouseDown={(e) => e.preventDefault()} edge="end" disabled={disabled}>
        {shown ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );
};

export default PasswordToggle;
