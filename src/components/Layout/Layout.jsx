import React from 'react';
import { Container, Box } from '@mui/material';
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
      <Container component="main" sx={{ mt: 4, mb: isLoggedIn ? 10 : 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
      <BottomNav />
    </Box>
  );
};

export default Layout;