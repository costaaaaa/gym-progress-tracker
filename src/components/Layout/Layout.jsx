import { Container, Box, Link, Typography } from '@mui/material';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  // Utilizziamo il context di autenticazione - questo forza il re-render quando cambia lo stato di autenticazione
  const { isLoggedIn } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container
        component="main"
        disableGutters
        sx={{
          mt: 4,
          mb: isLoggedIn ? 10 : 4,
          flexGrow: 1,
          maxWidth: { xs: '100%', md: '1180px' },
          px: { xs: 2, md: '32px' },
        }}
      >
        <Outlet />
      </Container>
      <Box
        component="footer"
        sx={{ textAlign: 'center', pb: { xs: isLoggedIn ? 10 : 2, md: 2 }, px: 2 }}
      >
        <Typography variant="caption" color="text.secondary">
          <Link href="/privacy.html" color="inherit" underline="hover">Privacy</Link>
          {' · '}
          <Link href="/termini.html" color="inherit" underline="hover">Termini d&apos;uso</Link>
        </Typography>
      </Box>
      <BottomNav />
    </Box>
  );
};

export default Layout;