# Screenshot prima/dopo

Strumenti per dimostrare che una modifica non cambia nulla a schermo (es. un refactor di stile).
Si scattano le stesse pagine dalla build di riferimento (di solito `origin/main`, cartella `before`)
e dalla build modificata (cartella `after`), poi `compare.mjs` le confronta pixel per pixel.

Il kit è separato dall'app: ha un suo `package.json` e non tocca quello di `gym-progress-tracker`.

## Script

- `shots.mjs <cartella> [porta]`: 18 pagine, la pagina di una scheda in modifica con i dialog dell'editor
  delle serie (4 immagini) e le 5 schermate del Focus, con 390 e 1440 px di larghezza e tema
  chiaro/scuro. Ogni schermata usa un contesto browser nuovo con orologio fisso
  (2026-10-23 10:00, Europe/Rome), `reducedMotion: reduce`, animazioni CSS azzerate, font pronti
  e rete ferma.
  Le API sono finte: ogni risposta del backend è in `fixtures` dentro `shots.mjs`, con dati inventati
  (dominio `example.com`, nomi `atleta_*`).
- `shots.mjs <cartella> <porta> <nomi>`: con un terzo parametro (nomi separati da virgola, es. `allenamenti-piani,focus-scelta-giorno`) scatta solo i flussi che producono quelle schermate (un flusso, come il Focus o l'editor dei piani, scatta tutte le sue immagini).
  Le schermate `allenamenti-piani-ricche*`, `allenamenti-piani-pagina-ricche*` e `focus-scelta-giorno-un-giorno|vuoto` usano schede con più giorni e giorni vuoti.
- `SHOTS_WIDTHS=320,390` (variabile d'ambiente, anche dentro `docker run -e`): sostituisce le larghezze di base 390 e 1440; il nome dei file usa la larghezza scelta.
- `compare.mjs [A=before] [B=after]`: confronto con pixelmatch (soglia 0). Le differenze finiscono in `diff/`.
  Esce con 1 se c'è almeno una differenza o un file mancante.

Pagine (file `<nome>_<390|1440>_<light|dark>.png`): `landing` (ospite), `home`, `home-nuovo` (utente senza scheda né allenamenti), `progressi`, `progressi-nuovo` (un solo allenamento: ogni esercizio è "Nuovo"), `misure`,
`account`, `profilo`, `gruppi`, `gruppo-dettaglio`, `allenamenti-piani` (elenco compatto),
`allenamenti-piani-ricche` (elenco con più schede), `allenamenti-piani-pagina` (pagina di una scheda attiva in lettura, con «Inizia»),
`allenamenti-piani-pagina-non-attiva` (con «Rendi attiva»), `allenamenti-piani-pagina-ricche` (giorni con più di 4 esercizi, giorno vuoto),
`allenamenti-piani-pagina-ricche-modifica` (la stessa in modifica), `allenamenti-piani-giorni` (pagina in modifica con tutti i comandi),
`allenamenti-piani-aggiungi-compatto`, `allenamenti-piani-aggiungi-lista`,
`allenamenti-piani-modifica-lista`, `allenamenti-cronologia` (elenco con due mesi: un allenamento con giorno della scheda e record, uno senza giorno, uno senza durata),
`storico-allenamento` (pagina di un allenamento), `storico-allenamento-elimina` (la stessa con la conferma aperta), `admin` (utente con `is_admin`),
`focus-scelta-giorno`, `focus-allenamento`, `focus-recupero`, `focus-riscaldamento`, `focus-riepilogo`.

Piano Gratis (account finto con `tier: free`, tetti di 2 schede e 4 giorni, risposta `dashboard` ridotta):
`home-gratis`, `muscoli-gratis`, `allenamenti-piani-sola-lettura-schede` (elenco con l'avviso), `allenamenti-piani-sola-lettura-giorni` (pagina in modifica con l'avviso),
`allenamenti-piani-limite`, `allenamenti-piani-nuova-gratis`, `allenamenti-piani-elimina-giorno` (dialog aperto dalla pagina),
`focus-plus-allenamento`, `focus-plus-dialogo`. Tutte le altre pagine usano un account senza tetti
(`tier: pro`, `dashboard` completo). Per scattare solo le nuove: terzo parametro con i loro nomi e cartella `after-gratis`.

Barra di navigazione: `barra-ventaglio-2` (senza modulo Misure: due voci), `barra-ventaglio-3` (tre voci),
`barra-ventaglio-riprendi` (con un allenamento in corso: «Riprendi»), tutte con il bottone centrale aperto e
solo sotto i 900 px; `barra-desktop-menu` (menu «Altre azioni» del bottone diviso, solo 1440). Le pagine
Schede e Storico stanno su `/schede` e `/storico`; la pagina di una scheda su `/schede/<id>`, quella di un allenamento su `/storico/<id>`.

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
  indicano una pagina con dati finti incompleti, anche se non sempre bloccano.
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
