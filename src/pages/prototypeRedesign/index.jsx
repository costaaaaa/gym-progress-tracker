// PROTOTIPO (da buttare): struttura nuova, giro 1. Rotta /prototype/redesign, solo in sviluppo. Dati finti, nessun backend.
import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useThemeMode } from '../../context/ThemeModeContext';
import { useProto } from './useProto';
import ProtoSwitcher from './ProtoSwitcher';
import HomeScreen, { Header } from './HomeScreen';
import BottomBar from './BottomBar';
import CenterMenu from './CenterMenu';
import Fan from './Fan';
import SerieScreen from './SerieScreen';

const TAB_NAMES = { schede: 'Schede', storico: 'Storico', progressi: 'Progressi' };

const PrototypeRedesign = () => {
  const { values, set } = useProto();
  const { mode, toggleThemeMode } = useThemeMode();
  const [tab, setTab] = useState('home');
  const [aperto, setAperto] = useState(false);

  // Il parametro tema (chiaro|scuro) porta il tema dell'app a quel valore
  useEffect(() => {
    if (values.tema && (values.tema === 'scuro') !== (mode === 'dark')) toggleThemeMode();
  }, [values.tema, mode, toggleThemeMode]);

  const start = () => { setAperto(false); set('s', 'serie'); };
  const modules = values.moduli === 'tutti';

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: (t) => (t.palette.mode === 'dark' ? '#000' : '#e4e2df'), display: 'flex', justifyContent: 'center', alignItems: 'center', '@media (min-width:500px)': { py: 2 } }}>
      <Box
        sx={{
          position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary',
          width: '100%', height: '100dvh',
          '@media (min-width:500px)': { width: 390, height: 844, border: '1px solid', borderColor: 'text.secondary', borderRadius: '28px' },
        }}
      >
        {values.s === 'serie' ? (
          <SerieScreen tecniche={values.tecniche} strumenti={values.strumenti} bozza={values.bozza === '1'} onExit={() => set('s', 'home')} />
        ) : (
          <>
            <Header logo={values.logo} />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {tab === 'home' ? (
                <HomeScreen key={values.moduli} moduli={values.moduli} bozza={values.bozza === '1'} onStart={start} />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{TAB_NAMES[tab]}</Typography>
                  <Typography color="text.secondary">Nel prossimo giro</Typography>
                </Box>
              )}
            </Box>
            <BottomBar tab={tab} onTab={(t) => { setAperto(false); setTab(t); }} logo={values.logo} open={aperto && values.menu === 'ventaglio'} onCenter={() => setAperto((o) => !o)} />
            {values.menu === 'pannello'
              ? <CenterMenu open={aperto} onClose={() => setAperto(false)} onStart={start} bozza={values.bozza === '1'} moduli={modules} />
              : <Fan compact={values.tondi === 'compatti'} open={aperto} onClose={() => setAperto(false)} onStart={start} bozza={values.bozza === '1'} moduli={modules} />}
          </>
        )}
      </Box>
      <ProtoSwitcher values={values} set={set} />
    </Box>
  );
};

export default PrototypeRedesign;
