# Screenshot prima/dopo

Strumenti per dimostrare che una modifica non cambia nulla a schermo (es. un refactor di stile).
Si scattano le stesse pagine dalla build di riferimento (di solito `origin/main`, cartella `before`)
e dalla build modificata (cartella `after`), poi `compare.mjs` le confronta pixel per pixel.

Il kit è separato dall'app: ha un suo `package.json` e non tocca quello di `gym-progress-tracker`.

## Script

- `shots.mjs <cartella> [porta]`: 11 pagine più le 4 fasi del Focus, con 390 e 1440 px di larghezza
  e tema chiaro/scuro (60 immagini). Ogni schermata usa un contesto browser nuovo con orologio fisso
  (2026-10-23 10:00, Europe/Rome), `reducedMotion: reduce`, animazioni CSS azzerate, font pronti e rete ferma.
  Le API sono finte: ogni risposta del backend è in `fixtures` dentro `shots.mjs`, con dati inventati
  (dominio `example.com`, nomi `atleta_*`).
- `compare.mjs [A=before] [B=after]`: confronto con pixelmatch (soglia 0). Le differenze finiscono in `diff/`.
  Esce con 1 se c'è almeno una differenza o un file mancante.

Pagine (file `<nome>_<390|1440>_<light|dark>.png`): `landing` (ospite), `home`, `progressi`, `misure`,
`account`, `profilo`, `gruppi`, `gruppo-dettaglio`, `allenamenti-piani`, `allenamenti-cronologia`,
`admin` (utente con `is_admin`), `focus-scelta-giorno`, `focus-allenamento`, `focus-recupero`, `focus-riepilogo`.

## Prerequisiti

- Node.js e Docker.
- Le versioni di Playwright devono coincidere: il pacchetto npm e l'immagine docker sono entrambi `1.64.1`.
  Installazione una volta sola, nella cartella del kit:

  ```bash
  cd tools/screenshots && npm ci
  ```

- Immagine del browser (da non rimuovere, serve a ogni giro):
  `mcr.microsoft.com/playwright:v1.64.1-noble`

## Comandi

Sostituire `<repo>` con la cartella del repo e `<porta>` con una porta libera. Nell'esempio:
`before` è `origin/main`, `after` è il branch da verificare.

```bash
# 1. build e preview della versione di riferimento (before)
cd <repo-main> && npm ci && npm run build
nohup ./node_modules/.bin/vite preview --strictPort --port <porta> > <repo>/tools/screenshots/vite-<porta>.log 2>&1 &
echo $! > <repo>/tools/screenshots/vite-<porta>.pid

# 2. screenshot (cartella e porta come parametri)
cd <repo>/tools/screenshots && docker run --rm --network host --ipc=host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/shots -w /shots \
  mcr.microsoft.com/playwright:v1.64.1-noble node shots.mjs before <porta>

# 3. fermare il preview (PID salvato in file)
kill "$(cat <repo>/tools/screenshots/vite-<porta>.pid)"
```

Per il dopo: stesso procedimento sul worktree del branch, con cartella `after`. Porta: vedi sotto.

Confronto:

```bash
cd tools/screenshots && node compare.mjs before after
```

Lo script stampa una riga per immagine (`identica` oppure `N pixel diversi`) e un riepilogo finale.
Il codice di uscita è 0 solo se tutte le immagini coincidono.

## Controllo di determinismo

Prima di fidarsi del confronto, verificare che lo stesso codice dia le stesse immagini:
lanciare due volte `shots.mjs` sulla stessa build (cartelle `before` e `before-bis`), poi:

```bash
node compare.mjs before before-bis    # deve dare 0 differenze
```

## Porta e link di invito

Nella pagina `gruppo-dettaglio` il link di invito contiene l'indirizzo del server (host e porta).
Se "before" e "after" girano su porte diverse, quell'immagine risulta diversa per un motivo che
non è il codice. Per questo: servire una build alla volta sulla stessa porta, fare lo screenshot,
fermarla, poi servire l'altra build sulla stessa porta e rifare lo screenshot.

## Avvisi ed errori

- Lo script stampa "Pagine NON riuscite" con il motivo ed esce con 1. Un'immagine mancante non viene
  salvata: non va confrontata come se fosse valida.
- Gli "Avvisi" sono errori di console e testo sospetto (es. "errore nel caricamento"). Vanno letti:
  non sono per forza bloccanti, ma indicano una pagina con dati finti incompleti.
- Lo spinner di attesa esclude le barre di avanzamento determinate (`aria-valuenow`), che restano visibili
  di proposito. Se una pagina resta bloccata, lo script riporta quale elemento è ancora in caricamento.

## Quando cambia la forma dei dati

Se una pagina cambia la struttura della risposta del backend, aggiornare la fixture corrispondente in
`shots.mjs` (chiave `fixtures`, testo che contiene il percorso dell'endpoint). Una fixture incompleta
produce errori tipo `Cannot read properties of undefined`, che lo script riporta tra le pagine non riuscite.
Le fixture devono restare inventate: niente email, nomi o gruppi reali.

## Pulizia

Le cartelle delle immagini (`before/`, `before-bis/`, `after/`, `diff/`) e i log sono ignorati da git
(`.gitignore` locale). Non committarle: le immagini si ricreano in pochi minuti.
