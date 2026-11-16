import { Box, TextField } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { visuallyHidden } from '@mui/utils';

// Campo «Conferma password» con la riga sempre presente sotto (suggerimento, spunta o errore) e la regione
// che annuncia l'esito. `pair` è il risultato di useConfirmPassword. `errorText`, se c'è, prende il posto
// della riga come errore (la registrazione lo usa per «Avanti» a conferma vuota). Il resto va al TextField.
const ConfirmPasswordField = ({ pair, errorText, ...props }) => {
  const { state, text, announce, leave } = pair;
  return (
    <>
      <Box onBlur={leave}>
        <TextField
          {...props}
          error={state === 'mismatch' || Boolean(errorText)}
          helperText={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: state === 'match' ? 'success.main' : undefined }}>
              {state === 'match' && <CheckCircleOutlineIcon aria-hidden fontSize="inherit" sx={{ fontSize: '1.2em' }} />}
              {errorText || text}
            </Box>
          }
          // Il campo attivo ha bordo ed etichetta neutri: il rosso del marchio, sotto una scritta verde o grigia, sembrerebbe un errore
          sx={{
            '& .MuiOutlinedInput-root.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: 'text.primary' },
            '& .MuiFormLabel-root.Mui-focused:not(.Mui-error)': { color: 'text.primary' },
          }}
        />
      </Box>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>{announce}</Box>
    </>
  );
};

export default ConfirmPasswordField;
