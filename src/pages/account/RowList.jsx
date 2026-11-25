import { Children } from 'react';
import { Box, Card } from '@mui/material';

// Una card con le righe in un elenco, separate da una linea. Ogni figlio è una riga; i figli hanno una `key`.
const RowList = ({ children }) => (
  <Card>
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {Children.toArray(children).map((child, index) => (
        <Box component="li" key={child.key} sx={index > 0 ? { borderTop: '1px solid', borderColor: 'divider' } : undefined}>
          {child}
        </Box>
      ))}
    </Box>
  </Card>
);

export default RowList;
