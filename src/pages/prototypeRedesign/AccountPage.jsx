// PROTOTIPO (da buttare): pagina Account (elenco di sei voci oppure tutto in una pagina)
import { useState } from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { Back, NavRow, Seg, Toggle } from './ui';
import { cardSx, labelSx, titleSx } from './styles';
import { radius } from '../../theme/radius';

const SECTIONS = [['profilo', 'Profilo', 'Nome, email, dati fisici, unità'], ['preferenze', 'Preferenze', 'Lingua, tema, obiettivo, timer'], ['moduli', 'Moduli', 'Cosa vedi nell\'app'], ['piano', 'Piano', 'Gratis'], ['dati', 'Dati e privacy', 'Consensi, import, export'], ['sicurezza', 'Sicurezza', 'Password']];
const MODULES = [['misure', 'Misure', 'Peso, composizione, circonferenze', 'progressi'], ['cardio', 'Cardio', 'Corsa, bici e altro', 'storico'], ['recupero', 'Recupero e serie per muscolo', 'Stato dei muscoli', 'progressi'], ['livelli', 'Livelli e traguardi', 'Punti, streak, traguardi', 'home'], ['gruppi', 'Gruppi', 'Allenati con altre persone', 'home'], ['ai', 'Assistenti AI', 'Collega un assistente ai tuoi dati', 'home']];
const PLANS = [['Gratis', 'Per iniziare'], ['Plus', 'Più schede e storico lungo'], ['Pro', 'Tutto sbloccato']];
const btn = { minHeight: 44, borderRadius: radius.lg, fontWeight: 600 };
const Field = (props) => <TextField size="small" fullWidth {...props} slotProps={{ htmlInput: { 'aria-label': props.label } }} />;
const Card = ({ title, children }) => (
  <Box sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Typography sx={labelSx}>{title}</Typography>
    {children}
  </Box>
);

const Profilo = () => {
  const [unit, setUnit] = useState('m');
  return (
    <Card title="Profilo">
      <Field label="Nome" defaultValue="Andrea" />
      <Field label="Email" defaultValue="andrea@example.com" />
      <Field label="Profilo fisico" defaultValue="Uomo, 1,78 m, 78,4 kg" />
      <Seg label="Unità di misura" value={unit} onChange={setUnit} options={[{ value: 'm', label: 'Metriche' }, { value: 'i', label: 'Imperiali' }]} />
    </Card>
  );
};

const Preferenze = () => {
  const [tema, setTema] = useState('auto');
  return (
    <Card title="Preferenze">
      <Field select label="Lingua" defaultValue="it"><MenuItem value="it">Italiano</MenuItem><MenuItem value="en">English</MenuItem></Field>
      <Seg label="Tema" value={tema} onChange={setTema} options={[{ value: 'auto', label: 'Auto' }, { value: 'chiaro', label: 'Chiaro' }, { value: 'scuro', label: 'Scuro' }]} />
      <Field select label="Obiettivo settimanale" defaultValue="3"><MenuItem value="2">2 allenamenti</MenuItem><MenuItem value="3">3 allenamenti</MenuItem><MenuItem value="4">4 allenamenti</MenuItem></Field>
      <Field select label="Timer di recupero" defaultValue="90"><MenuItem value="60">1:00</MenuItem><MenuItem value="90">1:30</MenuItem><MenuItem value="120">2:00</MenuItem></Field>
      <Toggle label="Strumenti della serie" hint="Nota, dischi, RIR/RPE" checked onChange={() => {}} />
      <Field select label="Formula 1RM" defaultValue="epley"><MenuItem value="epley">Epley</MenuItem><MenuItem value="brzycki">Brzycki</MenuItem></Field>
    </Card>
  );
};

const Moduli = ({ setMany }) => {
  const [on, setOn] = useState({ misure: true, cardio: true, recupero: true, livelli: true, gruppi: false, ai: true });
  return (
    <Card title="Moduli">
      {MODULES.map(([k, l, h, to]) => (
        <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}><Toggle label={l} hint={h} checked={on[k]} onChange={(v) => setOn((o) => ({ ...o, [k]: v }))} /></Box>
          {on[k] && <Button color="inherit" onClick={() => setMany({ s: to, pagina: null })} sx={{ ...btn, minWidth: 60 }}>Apri</Button>}
        </Box>
      ))}
    </Card>
  );
};

const Piano = () => (
  <Card title="Piano">
    {PLANS.map(([n, d]) => (
      <Box key={n} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box><Typography sx={{ fontWeight: 600 }}>{n}</Typography><Typography variant="body2" color="text.secondary">{d}</Typography></Box>
        {n === 'Gratis' && <Typography sx={{ px: 1.25, py: 0.25, borderRadius: radius.pill, bgcolor: 'success.main', color: '#fff', fontSize: 13, fontWeight: 700 }}>Attuale</Typography>}
      </Box>
    ))}
  </Card>
);

const Dati = () => {
  const [consent, setConsent] = useState(true);
  const [health, setHealth] = useState(false);
  return (
    <Card title="Dati e privacy">
      <Toggle label="Consenso alle misure" hint="Peso e misure corporee" checked={consent} onChange={setConsent} />
      <Toggle label="Dati di salute" hint="Sincronizza passi e battito" checked={health} onChange={setHealth} />
      <Typography variant="body2" color="text.secondary">Assistenti AI collegati: 1</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" color="inherit" sx={btn}>Importa</Button>
        <Button variant="outlined" color="inherit" sx={btn}>Esporta i dati</Button>
      </Box>
    </Card>
  );
};

const Sicurezza = () => (
  <Card title="Sicurezza">
    <Field label="Password attuale" type="password" />
    <Field label="Nuova password" type="password" />
    <Button variant="outlined" color="inherit" sx={{ ...btn, alignSelf: 'flex-start' }}>Cambia password</Button>
  </Card>
);

const render = (k, setMany) => ({ profilo: <Profilo />, preferenze: <Preferenze />, moduli: <Moduli setMany={setMany} />, piano: <Piano />, dati: <Dati />, sicurezza: <Sicurezza /> }[k]);

const AccountPage = ({ values, detail, setMany }) => {
  const section = detail('pagina');
  const found = SECTIONS.find(([k]) => k === section);
  const footer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
      <Button variant="outlined" color="inherit" sx={btn}>Esci</Button>
      <Button color="error" sx={{ minHeight: 40, fontSize: 13 }}>Elimina account</Button>
    </Box>
  );
  const head = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.default', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22 }}>A</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" sx={{ ...titleSx, fontSize: '1.3rem', fontWeight: 700 }}>Andrea</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>andrea@example.com</Typography>
      </Box>
    </Box>
  );
  if (values.account === 'pagina') {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {head}
        {SECTIONS.map(([k]) => <Box key={k}>{render(k, setMany)}</Box>)}
        {footer}
      </Box>
    );
  }
  if (found) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Back onClick={() => setMany({ pagina: null })} /><Typography component="h1" sx={{ ...titleSx, fontSize: '1.3rem', fontWeight: 700 }}>{found[1]}</Typography></Box>
        {render(found[0], setMany)}
      </Box>
    );
  }
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {head}
      <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        {SECTIONS.map(([k, t, s], i) => (
          <Box key={k} sx={{ borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}><NavRow title={t} subtitle={s} onClick={() => setMany({ pagina: k })} /></Box>
        ))}
      </Box>
      {footer}
    </Box>
  );
};

export default AccountPage;
