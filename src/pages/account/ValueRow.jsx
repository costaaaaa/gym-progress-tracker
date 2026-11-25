import { useId } from 'react';
import { Box, CardActionArea, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Riga di un'impostazione: il titolo a sinistra, il valore di adesso e la freccia a destra. È un pulsante che apre la
// finestra con il controllo (`onClick`). Il nome del pulsante è il titolo, il valore è la sua descrizione: il lettore di
// schermo dice «Lingua, pulsante, Italiano». Se lo spazio non basta va a capo il titolo, mai il valore. Un dato lungo
// che non sta nel valore (un indirizzo) va in `detail`, sotto il titolo, e fa parte della descrizione prima del valore;
// `valueColor` dà al valore un colore del tema al posto del grigio (uno stato da notare); senza `value` non c'è valore.
const ValueRow = ({ title, value, detail, valueColor = 'text.secondary', onClick }) => {
  const id = useId();

  return (
    <CardActionArea
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={[detail && `${id}-detail`, value && `${id}-value`].filter(Boolean).join(' ') || undefined}
      sx={{ minHeight: 56, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography id={`${id}-title`} sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{title}</Typography>
        {detail && <Typography id={`${id}-detail`} sx={{ fontSize: 16, color: 'text.secondary', overflowWrap: 'anywhere' }}>{detail}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {value && <Typography id={`${id}-value`} sx={{ fontSize: 16, color: valueColor, whiteSpace: 'nowrap' }}>{value}</Typography>}
        <ChevronRightIcon sx={{ color: 'text.secondary' }} />
      </Box>
    </CardActionArea>
  );
};

export default ValueRow;
