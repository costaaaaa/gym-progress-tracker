import { useId } from 'react';
import { Box, CardActionArea, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink } from 'react-router-dom';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Riga dell'elenco dell'Account: un collegamento con titolo, riga di aiuto (facoltativa) e freccia. Il nome del
// collegamento è il titolo, l'aiuto è la sua descrizione.
const AccountRow = ({ to, title, help }) => {
  const id = useId();

  return (
    <CardActionArea
      component={RouterLink}
      to={to}
      aria-labelledby={`${id}-title`}
      aria-describedby={help ? `${id}-help` : undefined}
      sx={{ minHeight: 64, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography id={`${id}-title`} sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{title}</Typography>
        {help && <Typography id={`${id}-help`} sx={{ mt: 0.5, fontSize: 16, color: 'text.secondary' }}>{help}</Typography>}
      </Box>
      <ChevronRightIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </CardActionArea>
  );
};

export default AccountRow;
