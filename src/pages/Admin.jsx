import { useEffect, useState } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { usePageMeta } from '../hooks/usePageMeta';
import RequireLogin from '../components/Groups/RequireLogin';
import AdminExercises from '../components/Admin/AdminExercises';
import { listAdminExercises } from '../api/exercises';

// Area admin. Chi non è admin riceve 404 dal server e qui vede "pagina non trovata":
// il link compare solo agli admin (Account), ma la protezione vera è lato server.
// Le sezioni sono impilate: la build premium aggiunge la sua dopo <AdminExercises />.
const AdminContent = () => {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    listAdminExercises().then((res) => setAllowed(res.ok));
  }, []);

  if (allowed === null) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }
  if (!allowed) {
    return <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>Pagina non trovata.</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <AdminExercises />
    </Box>
  );
};

const Admin = () => {
  usePageMeta('Admin', 'Area di amministrazione di LiftIndex.');
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 22, mb: 3 }}>Admin</Typography>
      <RequireLogin>
        <AdminContent />
      </RequireLogin>
    </Container>
  );
};

export default Admin;
