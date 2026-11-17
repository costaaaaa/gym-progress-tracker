import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { errorMessage } from '../../api/exercises';
import { createSignupCode, deleteSignupCode, getSignupCode, listSignupCodes, updateSignupCode } from '../../api/signupCodes';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { formatDay, tierName } from '../../utils/tiers';
import SignupCodeForm from './SignupCodeForm';

const TEXT = { fontSize: 16 };
const BUTTON = { minHeight: 44, fontSize: 16 };

// Istante ISO → giorno nel fuso del browser
const formatInstant = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const USE_STATUS = { applied: 'Confermato', pending: 'In attesa di conferma', missed: 'Non applicato' };

// Link da dare a chi si registra: il campo del codice si apre già compilato
const registerLink = (code) => `${window.location.origin}/register?code=${encodeURIComponent(code)}`;

// Durata del livello: «PER SEMPRE» in evidenza (inchiostro pieno), altrimenti i giorni
const Duration = ({ code }) => (code.forever ? (
  <Typography component="span" sx={{ ...TEXT, fontWeight: 700, px: 1, bgcolor: 'ink', color: 'onInk' }}>PER SEMPRE</Typography>
) : (
  <Typography component="span" sx={TEXT}>{code.duration_days === 1 ? '1 giorno' : `${code.duration_days} giorni`}</Typography>
));

const expiryText = (code) => {
  if (!code.last_day) return 'Non scade';
  return code.expired ? `Scaduto il ${formatDay(code.last_day)}` : `Scade il ${formatDay(code.last_day)}`;
};

// «Pagina 2 di 5» con Precedente e Successiva; nulla se la pagina è una sola
const Pager = ({ page, pages, onPage }) => {
  if (pages <= 1) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Pagina precedente" sx={BUTTON}>Precedente</Button>
      <Typography sx={TEXT}>{`Pagina ${page} di ${pages}`}</Typography>
      <Button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Pagina successiva" sx={BUTTON}>Successiva</Button>
    </Box>
  );
};

const Loading = () => <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;

// Una riga dell'elenco
const CodeRow = ({ code, onOpen }) => (
  <Box component="li" aria-label={code.code} sx={{ listStyle: 'none', py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', columnGap: 2 }}>
      <Typography component="span" sx={{ ...TEXT, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>{code.code}</Typography>
      <Button onClick={() => onOpen(code.id)} aria-label={`Apri il codice ${code.code}`} sx={{ ...BUTTON, flexShrink: 0 }}>Apri</Button>
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, color: 'text.secondary' }}>
      <Typography component="span" sx={{ ...TEXT, fontWeight: 600, color: 'text.primary' }}>{tierName(code.tier)}</Typography>
      <Duration code={code} />
      <Typography component="span" sx={TEXT}>{`Posti ${code.seats_taken}/${code.max_uses}`}</Typography>
      <Typography component="span" sx={TEXT}>{`Registrati ${code.registered}`}</Typography>
      <Typography component="span" sx={TEXT}>{`Confermati ${code.confirmed}`}</Typography>
      <Typography component="span" sx={TEXT}>{expiryText(code)}</Typography>
      <Typography component="span" sx={TEXT}>{code.enabled ? 'Acceso' : 'Spento'}</Typography>
      <Typography component="span" sx={TEXT}>{code.assignee ? `Assegnato a ${code.assignee}` : 'Nessun assegnatario'}</Typography>
    </Box>
  </Box>
);

const CodeList = ({ notice, onOpen, onCreate }) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    listSignupCodes(page).then((res) => {
      if (!current) return;
      if (res.ok) { setData(res.data); setError(''); } else { setData(null); setError(errorMessage(res, 'Impossibile caricare i codici.')); }
    });
    return () => { current = false; };
  }, [page]);

  return (
    <>
      <Button variant="contained" onClick={onCreate} sx={{ ...BUTTON, mb: 2 }}>Nuovo codice</Button>
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && (data.codes.length === 0 ? (
        <Typography sx={{ ...TEXT, color: 'text.secondary' }}>Nessun codice.</Typography>
      ) : (
        <Box component="ul" aria-label="Codici di registrazione" sx={{ m: 0, p: 0 }}>
          {data.codes.map((code) => <CodeRow key={code.id} code={code} onOpen={onOpen} />)}
        </Box>
      ))}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </>
  );
};

// Gli iscritti con il codice, a pagine
const Uses = ({ uses, page, pages, onPage }) => (
  <>
    <Typography component="h3" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 18, mt: 3, mb: 1 }}>Iscritti</Typography>
    {uses.length === 0 ? (
      <Typography sx={{ ...TEXT, color: 'text.secondary' }}>Nessun iscritto.</Typography>
    ) : (
      <Box component="ul" aria-label="Iscritti con questo codice" sx={{ m: 0, p: 0 }}>
        {/* Il server non manda un id dell'uso: la chiave è registrazione + utente; l'indice solo per gli account eliminati (senza nome) */}
        {uses.map((use, i) => (
          <Box component="li" key={use.username ? `${use.created_at}|${use.username}` : `${use.created_at}||${i}`} sx={{ listStyle: 'none', py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
            <Typography component="span" sx={{ ...TEXT, fontWeight: 600, wordBreak: 'break-word' }}>{use.account_deleted ? 'Account eliminato' : use.username}</Typography>
            <Typography component="span" sx={TEXT}>{USE_STATUS[use.status] ?? use.status}</Typography>
            <Typography component="span" sx={{ ...TEXT, color: 'text.secondary' }}>{`Registrato il ${formatInstant(use.created_at)}`}</Typography>
            {use.applied_at && <Typography component="span" sx={{ ...TEXT, color: 'text.secondary' }}>{`Attivo dal ${formatInstant(use.applied_at)}`}</Typography>}
          </Box>
        ))}
      </Box>
    )}
    <Pager page={page} pages={pages} onPage={onPage} />
  </>
);

const CodeDetail = ({ id, onBack, onDeleted }) => {
  const [code, setCode] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [usesPage, setUsesPage] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copy, setCopy] = useState('');
  const [saves, setSaves] = useState(0);
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => {
    let current = true;
    getSignupCode(id, pageNumber).then((res) => {
      if (!current) return;
      if (res.ok) {
        // Il codice si legge una volta: riletto a ogni pagina farebbe ripartire il modulo e perderebbe le modifiche
        setCode((prev) => prev ?? res.data.code);
        setUsesPage(res.data);
        setError('');
      } else {
        setError(errorMessage(res, 'Impossibile caricare il codice.'));
      }
    });
    return () => { current = false; };
  }, [id, pageNumber]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registerLink(code.code));
      setCopy('ok');
    } catch {
      setCopy('failed');
    }
  };

  const saved = (data) => {
    if (data === null) {
      setNotice('Nessuna modifica.');
      return;
    }
    setCode(data.code);
    setSaves((n) => n + 1);
    setNotice('Salvato.');
    setCopy('');
  };

  const remove = async () => {
    setAskDelete(false);
    const res = await deleteSignupCode(code.id);
    if (res.ok) onDeleted();
    else setError(errorMessage(res, 'Impossibile eliminare il codice.'));
  };

  if (!code) {
    return (
      <>
        <Button onClick={onBack} sx={{ ...BUTTON, px: 0 }}>Torna all'elenco</Button>
        {error ? <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert> : <Loading />}
      </>
    );
  }
  // Il server elimina insieme all'account gli usi mai confermati: «registered > 0» coincide con la sua regola. Se il server rifiuta lo stesso, l'errore si mostra.
  const hasUses = code.registered > 0;

  return (
    <>
      <Button onClick={onBack} sx={{ ...BUTTON, px: 0, mb: 1 }}>Torna all'elenco</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        <Typography component="h3" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 20, wordBreak: 'break-all' }}>{code.code}</Typography>
        <Typography component="span" sx={{ ...TEXT, fontWeight: 600 }}>{tierName(code.tier)}</Typography>
        <Duration code={code} />
      </Box>
      <Typography sx={{ ...TEXT, color: 'text.secondary' }}>
        {`Posti ${code.seats_taken}/${code.max_uses} · Registrati ${code.registered} · Confermati ${code.confirmed} · ${expiryText(code)}`}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, my: 1 }}>
        <Button variant="outlined" onClick={copyLink} sx={BUTTON}>Copia link</Button>
        <Typography role="status" sx={TEXT}>{copy === 'ok' ? 'Link copiato' : copy === 'failed' ? 'Copia non riuscita, copia il link:' : ''}</Typography>
        {copy === 'failed' && <Typography component="span" sx={{ ...TEXT, wordBreak: 'break-all' }}>{registerLink(code.code)}</Typography>}
      </Box>

      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ my: 2 }}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

      <SignupCodeForm
        key={saves}
        initial={code}
        locked={hasUses}
        submitLabel="Salva"
        onSubmit={(fields) => updateSignupCode(code.id, fields)}
        onDone={saved}
      />

      <Box sx={{ mt: 2 }}>
        {hasUses ? (
          <Typography sx={{ ...TEXT, color: 'text.secondary' }}>Un codice già usato non si elimina: spegnilo.</Typography>
        ) : (
          <Button color="error" onClick={() => setAskDelete(true)} sx={BUTTON}>Elimina codice</Button>
        )}
      </Box>

      {usesPage && <Uses uses={usesPage.uses} page={usesPage.page} pages={usesPage.pages} onPage={setPageNumber} />}

      {askDelete && (
        <Dialog open onClose={() => setAskDelete(false)} aria-labelledby="signup-delete-title">
          <DialogTitle id="signup-delete-title">{`Eliminare il codice ${code.code}?`}</DialogTitle>
          <DialogContent><Typography>Il codice non è mai stato usato. L'eliminazione non si annulla.</Typography></DialogContent>
          <DialogActions>
            <Button onClick={() => setAskDelete(false)} sx={BUTTON}>Annulla</Button>
            <Button color="error" variant="contained" onClick={remove} sx={BUTTON}>Elimina</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

// Codici di registrazione: elenco a pagine, creazione, dettaglio con gli iscritti, modifica, eliminazione
const AdminSignupCodes = () => {
  const [view, setView] = useState({ name: 'list' });
  const [notice, setNotice] = useState('');

  const backToList = useCallback((message = '') => {
    setNotice(message);
    setView({ name: 'list' });
  }, []);

  return (
    <Card sx={{ p: '24px' }}>
      <Typography component="h2" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 18, mb: 2 }}>Codici di registrazione</Typography>

      {view.name === 'list' && (
        <CodeList notice={notice} onOpen={(id) => setView({ name: 'detail', id })} onCreate={() => { setNotice(''); setView({ name: 'create' }); }} />
      )}
      {view.name === 'create' && (
        <SignupCodeForm
          submitLabel="Crea codice"
          onSubmit={createSignupCode}
          onCancel={() => backToList()}
          onDone={(data) => backToList(`Codice creato: ${data.code.code}`)}
        />
      )}
      {view.name === 'detail' && (
        <CodeDetail id={view.id} onBack={() => backToList()} onDeleted={() => backToList('Codice eliminato.')} />
      )}
    </Card>
  );
};

export default AdminSignupCodes;
