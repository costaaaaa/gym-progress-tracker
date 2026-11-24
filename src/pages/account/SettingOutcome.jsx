import { Typography } from '@mui/material';

// Esito di un salvataggio dentro una finestra: una regione «status» e una «alert», sempre nel DOM (vuote non occupano
// spazio), come in FocusToolsOptions senza `notify`. Con una finestra aperta la notifica della pagina non viene letta.
const SettingOutcome = ({ status = '', alert = '' }) => (
  <>
    <Typography role="status" sx={{ fontSize: 16, mt: status ? 1 : 0 }}>{status}</Typography>
    <Typography role="alert" sx={{ fontSize: 16, color: 'error.main', mt: alert ? 1 : 0 }}>{alert}</Typography>
  </>
);

export default SettingOutcome;
