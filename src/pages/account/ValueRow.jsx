import { forwardRef, useId } from 'react';
import { Box, CardActionArea, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Riga di un'impostazione: il titolo a sinistra, il valore di adesso e la freccia a destra. È un pulsante che apre la
// finestra con il controllo (`onClick`). Il nome del pulsante è il titolo, il valore è la sua descrizione: il lettore di
// schermo dice «Lingua, pulsante, Italiano». Se lo spazio non basta va a capo il titolo, mai il valore. Il `ref` è
// quello del pulsante: la pagina vi riporta il fuoco quando la finestra si chiude.
const ValueRow = forwardRef(({ title, value, onClick }, ref) => {
  const id = useId();

  return (
    <CardActionArea
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-value`}
      sx={{ minHeight: 56, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
    >
      <Typography id={`${id}-title`} sx={{ flex: 1, minWidth: 0, fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{title}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography id={`${id}-value`} sx={{ fontSize: 16, color: 'text.secondary', whiteSpace: 'nowrap' }}>{value}</Typography>
        <ChevronRightIcon sx={{ color: 'text.secondary' }} />
      </Box>
    </CardActionArea>
  );
});

export default ValueRow;
