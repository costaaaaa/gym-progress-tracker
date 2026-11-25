import { Box, Typography } from '@mui/material';
import RowList from './RowList';

// Un gruppo di impostazioni: il titolo (h2) e sotto la card con le righe (RowList).
const SettingsGroup = ({ title, children }) => (
  <Box>
    <Typography component="h2" sx={{ mb: 1, fontSize: 16, fontWeight: 700, color: 'text.secondary' }}>{title}</Typography>
    <RowList>{children}</RowList>
  </Box>
);

export default SettingsGroup;
