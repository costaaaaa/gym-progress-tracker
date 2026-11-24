import { Children } from 'react';
import { Box, Card, Typography } from '@mui/material';

// Un gruppo di impostazioni: il titolo (h2) e sotto una card con le righe in un elenco, separate da una linea.
const SettingsGroup = ({ title, children }) => (
  <Box>
    <Typography component="h2" sx={{ mb: 1, fontSize: 16, fontWeight: 700, color: 'text.secondary' }}>{title}</Typography>
    <Card>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {Children.toArray(children).map((child, index) => (
          <Box component="li" key={child.key} sx={index > 0 ? { borderTop: '1px solid', borderColor: 'divider' } : undefined}>
            {child}
          </Box>
        ))}
      </Box>
    </Card>
  </Box>
);

export default SettingsGroup;
