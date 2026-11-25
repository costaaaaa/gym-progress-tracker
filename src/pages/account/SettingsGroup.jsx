import { Box, Typography } from '@mui/material';
import RowList from './RowList';

// Un gruppo di impostazioni: il titolo (h2) e sotto la card con le righe (RowList) e, se c'è, una riga di nota (`footer`).
const SettingsGroup = ({ title, footer, children }) => (
  <Box>
    <Typography component="h2" sx={{ mb: 1, fontSize: 16, fontWeight: 700, color: 'text.secondary' }}>{title}</Typography>
    <RowList>{children}</RowList>
    {footer && <Typography sx={{ mt: 1, fontSize: 16, color: 'text.secondary' }}>{footer}</Typography>}
  </Box>
);

export default SettingsGroup;
