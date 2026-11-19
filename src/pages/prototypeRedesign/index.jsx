// PROTOTIPO (da buttare): struttura nuova. Rotta /prototype/redesign, solo in sviluppo. Dati finti, nessun backend.
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useThemeMode } from '../../context/ThemeModeContext';
import { useProto, MENU_VOCI, FLAGS } from './useProto';
import ProtoSwitcher from './ProtoSwitcher';
import HomeScreen, { Header } from './HomeScreen';
import BottomBar from './BottomBar';
import CenterMenu from './CenterMenu';
import Fan from './Fan';
import PrimaScreen from './PrimaScreen';
import SerieScreen from './SerieScreen';
import RecuperoScreen from './RecuperoScreen';
import RiepilogoScreen from './RiepilogoScreen';
import SchedePage from './SchedePage';
import StoricoPage from './StoricoPage';
import ProgressiPage from './ProgressiPage';
import AccountPage from './AccountPage';

const INITIAL_SETS = [
  { label: 'R', w: 20, r: 12 },
  { label: '1', w: 60, r: 10 },
  { label: '2', w: 60, r: 10 },
  { label: '3' },
  { label: '4' },
];
const INITIAL_TOOLS = { timer: true, suggerito: true, nota: false, dischi: false, rir: false };
const FULL_SCREEN = ['prima', 'serie', 'recupero', 'riepilogo'];
const NAV_RESET = { scheda: null, allenamento: null, esercizio: null, pagina: null };

const PrototypeRedesign = () => {
  const { values, set, setMany, detail } = useProto();
  const { mode, toggleThemeMode } = useThemeMode();
  const [aperto, setAperto] = useState(false);
  const [sets, setSets] = useState(INITIAL_SETS);
  const [weight, setWeight] = useState('62,5');
  const [reps, setReps] = useState('10');
  const [tools, setTools] = useState(INITIAL_TOOLS);
  const wk = { sets, setSets, weight, setWeight, reps, setReps };

  // Il parametro tema (chiaro|scuro) porta il tema dell'app a quel valore
  useEffect(() => {
    if (values.tema && (values.tema === 'scuro') !== (mode === 'dark')) toggleThemeMode();
  }, [values.tema, mode, toggleThemeMode]);

  // Il parametro strumenti (nessuno|tutti) accende o spegne nota, dischi e RIR/RPE; gli interruttori fanno il contrario
  useEffect(() => {
    setTools((t) => {
      const any = t.nota || t.dischi || t.rir;
      if (values.strumenti === 'tutti' && !any) return { ...t, nota: true, dischi: true, rir: true };
      if (values.strumenti === 'nessuno' && any) return { ...t, nota: false, dischi: false, rir: false };
      return t;
    });
  }, [values.strumenti]);
  const setTool = (key, value) => {
    const next = { ...tools, [key]: value };
    setTools(next);
    set('strumenti', next.nota || next.dischi || next.rir ? 'tutti' : 'nessuno');
  };

  const bozza = values.bozza === '1';
  const go = (screen) => set('s', screen);
  const start = () => { setAperto(false); go(bozza ? 'serie' : 'prima'); };
  const voci = MENU_VOCI[values.moduli];
  const flags = FLAGS[values.moduli];
  const tab = ['home', 'schede', 'storico', 'progressi'].includes(values.s) ? values.s : null;
  const full = FULL_SCREEN.includes(values.s);

  const screen = () => {
    if (values.s === 'prima') return <PrimaScreen tools={tools} setTool={setTool} giorno={Number(detail('giorno') ?? 1)} onExit={() => go('home')} onStart={() => go('serie')} />;
    if (values.s === 'serie') return <SerieScreen wk={wk} tools={tools} tecniche={values.tecniche} bozza={bozza} onExit={() => go('home')} go={go} />;
    if (values.s === 'recupero') return <RecuperoScreen wk={wk} tools={tools} onDone={() => go('serie')} />;
    return <RiepilogoScreen wk={wk} flags={flags} onDone={() => go('home')} />;
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: (t) => (t.palette.mode === 'dark' ? '#000' : '#e4e2df'), display: 'flex', justifyContent: 'center', alignItems: 'center', '@media (min-width:500px)': { py: 2 } }}>
      <Box
        sx={{
          position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary',
          width: '100%', height: '100dvh',
          '@media (min-width:500px)': { width: 390, height: 844, border: '1px solid', borderColor: 'text.secondary', borderRadius: '28px' },
        }}
      >
        {full ? screen() : (
          <>
            <Header logo={values.logo} onAvatar={() => setMany({ s: 'account', ...NAV_RESET })} />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {values.s === 'home' ? (
                <HomeScreen key={values.moduli} moduli={values.moduli} bozza={bozza} onStart={start} />
              ) : (
                <>
                  {values.s === 'schede' && <SchedePage detail={detail} setMany={setMany} />}
                  {values.s === 'storico' && <StoricoPage values={values} flags={flags} detail={detail} set={set} setMany={setMany} />}
                  {values.s === 'progressi' && <ProgressiPage values={values} flags={flags} detail={detail} set={set} setMany={setMany} />}
                  {values.s === 'account' && <AccountPage values={values} detail={detail} setMany={setMany} />}
                </>
              )}
            </Box>
            <BottomBar tab={tab} onTab={(t) => { setAperto(false); setMany({ s: t, ...NAV_RESET }); }} logo={values.logo} open={aperto && values.menu === 'ventaglio'} onCenter={() => setAperto((o) => !o)} />
            {values.menu === 'pannello'
              ? <CenterMenu open={aperto} onClose={() => setAperto(false)} onStart={start} bozza={bozza} voci={voci} />
              : <Fan variant={values.tondi} open={aperto} onClose={() => setAperto(false)} onStart={start} bozza={bozza} voci={voci} />}
          </>
        )}
      </Box>
      <ProtoSwitcher values={values} set={set} />
    </Box>
  );
};

export default PrototypeRedesign;
