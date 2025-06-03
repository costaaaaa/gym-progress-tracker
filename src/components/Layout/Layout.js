import React from 'react';
import { Container } from '@mui/material';
import Navbar from './Navbar';
import { useAuth } from '../../context/AuthContext';

const Layout = ({ children }) => {
  // Utilizziamo il context di autenticazione - questo forza il re-render quando cambia lo stato di autenticazione
  useAuth(); // Rimuovo l'oggetto pattern vuoto che causa warning

  return (
    <>
      <Navbar />
      <Container sx={{ mt: 4, mb: 4 }}>
        {children}
      </Container>
    </>
  );
};

export default Layout;