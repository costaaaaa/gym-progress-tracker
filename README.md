# LiftIndex

[🇮🇹 Versione Italiana](#-italiano) | [🇬🇧 English Version](#liftindex)

# 🇬🇧 English

## Description

**LiftIndex** (repository `gym-progress-tracker`) is a web application for people who want to track their gym workouts in a simple, flexible, and detailed way.

With it you can:

* Create and manage an unlimited number of **workout plans**;
* Use **Focus Mode** for an immersive, real-time workout with built-in rest timers;
* Add exercises and training sessions to the active plan;
* View **detailed statistics** on the progress of exercises over time;
* Calculate useful metrics such as:

  * Total volume
  * Total repetitions
  * Volume per set
  * Volume per repetition
  * A **progress index** based on multiple parameters;
* Explore your data through **interactive and clear charts**;
* Train together with friends in **groups** and share your workout as an image.

## Key Features

* ✅ Multi-plan management
* 🔥 **Focus Mode**: immersive interface for real-time workout tracking with rest timers and haptic feedback
* 💾 **Autosave**: local persistence to prevent data loss in Focus Mode
* ⏱️ **Workout duration**: saved with each session
* 📈 **Advanced Dashboard**: hub-based interface with interactive charts (Workout Progress & Body Stats)
* 📊 **Global Stats**: track workout frequency (weekly) and total volume (monthly)
* 🗓️ **History**: browse past workouts by month; edit the date or delete a session
* 👤 **Body Stats**: track body measurements, circumferences, and visualize progress
* 🏆 **Gamification**: XP points, athlete levels, per-exercise mastery, weekly streaks, and unlockable achievements
* 👥 **Groups**: create a group for friends or your gym, invite people with a code or link, and compete on a weekly leaderboard
* 🖼️ **Share card**: turn a workout into an image, with templates and your own photo (move and zoom it)
* ➕ **Personal exercises**: can't find an exercise? Create it; the app suggests similar names ("Did you mean…") to avoid duplicates. A personal exercise is visible only to you until an admin approves it for everyone
* 🛠️ **Admin page** (`/admin`): moderation queue for personal exercises. Admins are granted from the command line only (`backend/tools/admin.php`)
* 🩺 **Muscle Recovery Visualizer**: anatomical map displaying muscle fatigue and recovery state
* 🍎 **Apple Health & Health Connect** *(mobile app)*: two-way sync of weight, body fat and waist; Focus Mode workouts are saved to Health. On the web, Body Stats links to the app
* 🏋️ Add and edit exercises with intensity techniques (Drop sets, Rest-pause, Super sets)
* 🎯 **Smart Progress**: detailed metrics (Volume, Avg Weight, Estimated 1RM, Progress Index) for each exercise
* 📌 Ability to select an active workout plan
* 🔒 **Secure Authentication**: session-based login (30 days) with server-side **bcrypt** password hashing, a single password policy, rate limiting and **password recovery by email**
* 🛡️ **Privacy by design**: informed consents (terms, health data), privacy policy and terms pages, full **data export**, **account deletion**, periodic purge of data that is no longer needed
* 📱 **Mobile-ready API**: the same PHP backend also serves a native mobile client via Bearer tokens
* 📝 **Blog**: server-rendered PHP blog engine (Markdown articles, SEO meta and JSON-LD)
* 🌓 **Dark & Light Mode**: custom theme with persistent appearance toggle

## Technologies Used

* **React (v18)** with **Vite**
* **Material UI (MUI)** for the user interface
* **Recharts** for data visualization
* **PHP** (PDO REST API architecture)
* **MySQL** for data storage
* **ESLint** for frontend linting
* **Umami** (self-hosted, cookieless) for privacy-friendly analytics, only when configured

## Security

* **Passwords are hashed server-side with bcrypt** (`password_hash` / `password_verify`); the plaintext is sent only over HTTPS and is never stored.
* **Transparent migration**: accounts created with older hashes are automatically re-hashed to bcrypt on their next successful login (`backend/tools/wrap_legacy_hashes.php` wraps the old hashes in one go).
* **Session-based authentication** via PHP sessions for the web app; every request uses `credentials: 'include'`.
* **Bearer tokens** for the mobile client (`mobile_login.php`): only the SHA-256 hash of the token is stored, with a 30-day sliding expiration.
* **Rate limiting** on authentication, password recovery, group and exercise-creation endpoints to mitigate abuse.
* **Data retention**: `backend/tools/purge.php` (run daily from cron) deletes expired tokens, used or expired reset links and expired rate-limit counters.

## Try it Out

You can test the app directly here: 👉 [LiftIndex](https://liftindex.app/)

## Local Installation (Optional)

### Requirements

* Node.js and npm
* PHP 7.4+ and MySQL (e.g., via XAMPP, MAMP)

### Installation Guide

1. Clone the repository:

   ```bash
   git clone https://github.com/costaaaaa/gym-progress-tracker.git
   cd gym-progress-tracker
   ```
2. Install frontend dependencies and build:

   ```bash
   npm install
   npm run build
   ```
3. Import the MySQL database — see [Database setup & updates](#database-setup--updates) below.
4. Configure database access in the `backend/config/database.php` file (copy from `backend/config/database.php.example`);
5. Launch a local server (e.g., with XAMPP) and make sure the PHP files are correctly served. In development the frontend calls `http://localhost/gym-progress-tracker/backend/` (see `src/config.js`), so the repository folder must be reachable at that path.
6. Start the React app (Vite on port 3000):
   ```bash
   npm start
   ```
7. Optional: check the code with `npm run lint`.

### Server environment variables (optional)

| Variable | Purpose |
|---|---|
| `CORS_ALLOWED_ORIGINS` | Allowed origins, comma-separated (default: localhost:3000 and the production domain) |
| `APP_PUBLIC_URL` | Public URL of the app, used in the links sent by email |
| `MAIL_DRIVER` | `log` (default, development only: writes the email to the PHP error log, sends nothing), `mail` (PHP `mail()`, i.e. the server's sendmail) or `brevo` (Brevo transactional API, needs `MAIL_API_KEY`) |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Sender of the emails (name defaults to "LiftIndex") |
| `MAIL_LOG_FULL` | With the `log` driver, set to `1` to see the full reset link in development |
| `RL_*`, `RATE_LIMITER_DRIVER` | Rate limiting thresholds and driver |
| `LEGACY_STATS_PURGE_FROM` | Optional date (`YYYY-MM-DD`) from which `purge.php` removes body measurements entered before the health-data consent existed; off unless set |

### Command-line tools

Under `backend/tools/` (CLI only, they answer 404 over HTTP): `admin.php list|grant|revoke <user>` manages admins, `purge.php [--dry-run]` removes data that is no longer needed, `wrap_legacy_hashes.php [--dry-run]` wraps old password hashes in bcrypt.

### Tests

`tests/*.sh` are integration checks (access rules for personal exercises and groups, and the Apple Health / Health Connect sync rules) run against a live instance, for example `tests/groups_access.sh http://localhost/gym-progress-tracker/backend/`. They register throwaway accounts and delete them at the end: run them on a local or test instance, **never on a production one**.

### Blog (optional)

The PHP engine lives in `blog/`; articles are Markdown files in `blog/content/`, which are not part of the repository. See [`blog/content/README.md`](blog/content/README.md) for the format and local testing.

## Database setup & updates

### Fresh install (cloned from scratch)

Import **`backend/database/gym_progress_tracker.sql`** and you are done. It includes the complete unified schema: auth (including mobile API tokens and password recovery), workout plans, history, relational sets, body stats, gamification (weekly streak, XP, levels, exercise progression, achievements), groups, user consents, rate limiting, and default exercises.

### Updating an existing database

To upgrade an older database instance, execute:

* **`backend/database/schema_alter_migrations.sql`**: numbered, cumulative sections. They contain the `ALTER TABLE` statements (user profile and recovery fields, notes, intensity techniques, gamification, password change timestamps, last login, data from Apple Health / Health Connect, workout duration, personal exercises with approval status, admin flag), plus idempotent `CREATE TABLE IF NOT EXISTS` statements for tables introduced after the initial release (history/sets, gamification, rate limiting, mobile API tokens, password recovery, consents, groups). Run each section once: the `ALTER` statements are not idempotent.

When a release adds a section, only add columns and tables and remove the old ones in a later release: this way the previous version keeps working with the new schema.

## Author

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

If you find this project useful, consider giving it a ⭐ on GitHub!

---

# 🇮🇹 Italiano

[🇬🇧 English Version](#liftindex)

## Descrizione

**LiftIndex** (repository `gym-progress-tracker`) è un'applicazione web pensata per chi desidera tenere traccia dei propri allenamenti in palestra in modo semplice, flessibile e dettagliato.

Con questo strumento è possibile:

* Creare e gestire un numero illimitato di **schede di allenamento**;
* Utilizzare la **Modalità Focus** per un'esperienza immersiva durante l'allenamento con timer di recupero integrati;
* Aggiungere esercizi e sessioni di allenamento alla scheda attiva;
* Visualizzare **statistiche approfondite** sull'andamento degli esercizi nel tempo;
* Calcolare metriche utili come:

  * Volume totale
  * Ripetizioni totali
  * Volume per serie
  * Volume per ripetizione
  * Un **indice di avanzamento** complessivo basato su più parametri;
* Esplorare i dati tramite **grafici interattivi** e chiari;
* Allenarsi insieme agli amici nei **gruppi** e condividere l'allenamento come immagine.

## Funzionalità principali

* ✅ Gestione multi-scheda
* 🔥 **Modalità Focus**: interfaccia dedicata per l'allenamento in tempo reale con timer di recupero integrati e feedback aptico
* 💾 **Autosave**: salvataggio locale automatico per non perdere mai i progressi in Focus Mode
* ⏱️ **Durata dell'allenamento**: salvata con ogni sessione
* 📈 **Dashboard Avanzata**: interfaccia a hub per una consultazione rapida e chiara (Progressi Workout e Misure Corporee)
* 📊 **Statistiche Globali**: tracciamento frequenza (settimanale) e volume totale (mensile)
* 🗓️ **Cronologia**: allenamenti passati per mese; si può cambiare la data o eliminare una sessione
* 👤 **Body Stats**: tracciamento delle misure corporee, circonferenze e visualizzazione grafica
* 🏆 **Gamification**: punti XP, livello atleta, maestria per singolo esercizio, streak settimanale e achievement sbloccabili
* 👥 **Gruppi**: crea un gruppo di amici o della palestra, invita con un codice o un link e confrontatevi nella classifica settimanale
* 🖼️ **Card da condividere**: l'allenamento diventa un'immagine, con template e una tua foto (si sposta e si ingrandisce)
* ➕ **Esercizi personali**: non trovi un esercizio? Crealo; l'app suggerisce nomi simili ("Forse cercavi…") per evitare doppioni. Un esercizio personale lo vedi solo tu finché un admin non lo approva per tutti
* 🛠️ **Pagina admin** (`/admin`): coda di moderazione degli esercizi personali. Gli admin si assegnano solo da riga di comando (`backend/tools/admin.php`)
* 🩺 **Visualizzatore Recupero Muscolare**: mappa anatomica per monitorare l'affaticamento e il recupero dei gruppi muscolari
* 🍎 **Apple Salute e Health Connect** *(app mobile)*: peso, % grasso e girovita sincronizzati nei due sensi; gli allenamenti in Focus finiscono in Salute. Sul web, Misure Corporee rimanda all'app
* 🏋️ Aggiunta e modifica di esercizi con supporto a tecniche di intensità (Drop set, Rest-pause, Super set)
* 🎯 **Progressi Mirati**: metriche di dettaglio (Volume, Peso Medio, 1RM Stimato, Indice Progresso) per ogni singolo esercizio
* 📌 Possibilità di selezionare una scheda attiva
* 🔒 **Autenticazione sicura**: login basato su sessione (30 giorni) con hashing **bcrypt** lato server, un'unica regola per le password, rate limiting e **recupero password via email**
* 🛡️ **Privacy fin dal progetto**: consensi informati (termini, dati sulla salute), pagine di privacy policy e termini, **export completo dei dati**, **eliminazione dell'account**, pulizia periodica dei dati non più necessari
* 📱 **API pronte per il mobile**: lo stesso backend PHP serve anche un client mobile nativo tramite token Bearer
* 📝 **Blog**: motore blog in PHP renderizzato lato server (articoli in Markdown, meta SEO e JSON-LD)
* 🌓 **Tema Chiaro / Scuro**: supporto al cambio tema personalizzato persistente

## Tecnologie utilizzate

* **React (v18)** con **Vite**
* **Material UI (MUI)** per l'interfaccia utente
* **Recharts** per la visualizzazione dei dati
* **PHP** (Architettura REST API con PDO)
* **MySQL** per il salvataggio dei dati utente
* **ESLint** per il lint del frontend
* **Umami** (self-hosted, senza cookie) per statistiche di utilizzo rispettose della privacy, solo se configurato

## Sicurezza

* **Le password sono hashate lato server con bcrypt** (`password_hash` / `password_verify`); il testo in chiaro viaggia solo su HTTPS e non viene mai memorizzato.
* **Migrazione trasparente**: gli account con hash più vecchi vengono ri-hashati automaticamente in bcrypt al primo login andato a buon fine (`backend/tools/wrap_legacy_hashes.php` avvolge i vecchi hash in un colpo solo).
* **Autenticazione basata su sessione** tramite sessioni PHP per l'app web; ogni richiesta usa `credentials: 'include'`.
* **Token Bearer** per il client mobile (`mobile_login.php`): nel database finisce solo l'hash SHA-256 del token, con scadenza scorrevole di 30 giorni.
* **Rate limiting** sugli endpoint di autenticazione, recupero password, gruppi e creazione di esercizi per mitigare gli abusi.
* **Conservazione dei dati**: `backend/tools/purge.php` (da lanciare ogni giorno dal cron) elimina token scaduti, link di reset usati o scaduti e contatori del rate limiter scaduti.

## Come provarlo

Puoi testare l'app direttamente al seguente link: 👉 [LiftIndex](https://liftindex.app/)

## Installazione locale (facoltativa)

### Requisiti

* Node.js e npm
* PHP 7.4+ e MySQL (es. tramite XAMPP, MAMP)

### Guida all'installazione

1. Clona la repository:

   ```bash
   git clone https://github.com/costaaaaa/gym-progress-tracker.git
   cd gym-progress-tracker
   ```
2. Installa le dipendenze frontend e compila:

   ```bash
   npm install
   npm run build
   ```
3. Importa il database MySQL — vedi [Setup e aggiornamento del database](#setup-e-aggiornamento-del-database) più sotto.
4. Configura i dati di accesso al database nel file `backend/config/database.php` (copiando da `backend/config/database.php.example`);
5. Avvia il server locale (es. con XAMPP) e assicurati che i file PHP siano serviti correttamente. In sviluppo il frontend chiama `http://localhost/gym-progress-tracker/backend/` (vedi `src/config.js`), quindi la cartella del repo deve essere raggiungibile a quel percorso.
6. Avvia l'app React (Vite sulla porta 3000):
   ```bash
   npm start
   ```
7. Facoltativo: controlla il codice con `npm run lint`.

### Variabili d'ambiente del server (facoltative)

| Variabile | A cosa serve |
|---|---|
| `CORS_ALLOWED_ORIGINS` | Origin consentiti, separati da virgola (default: localhost:3000 e il dominio di produzione) |
| `APP_PUBLIC_URL` | URL pubblico dell'app, usato nei link inviati per email |
| `MAIL_DRIVER` | `log` (predefinito, solo sviluppo: scrive l'email nel log degli errori PHP, non invia nulla), `mail` (`mail()` di PHP, cioè il sendmail del server) o `brevo` (API transazionale Brevo, richiede `MAIL_API_KEY`) |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Mittente delle email (il nome è "LiftIndex" se omesso) |
| `MAIL_LOG_FULL` | Con il driver `log`, `1` mostra in sviluppo il link di reset completo |
| `RL_*`, `RATE_LIMITER_DRIVER` | Soglie e driver del rate limiting |
| `LEGACY_STATS_PURGE_FROM` | Data facoltativa (`AAAA-MM-GG`) da cui `purge.php` elimina le misure corporee inserite prima che esistesse il consenso sui dati sulla salute; spenta se non impostata |

### Strumenti da riga di comando

In `backend/tools/` (solo CLI, via HTTP rispondono 404): `admin.php list|grant|revoke <utente>` gestisce gli admin, `purge.php [--dry-run]` elimina i dati non più necessari, `wrap_legacy_hashes.php [--dry-run]` avvolge in bcrypt i vecchi hash delle password.

### Test

`tests/*.sh` sono controlli di integrazione (regole di accesso a esercizi personali e gruppi, regole della sincronizzazione con Apple Salute / Health Connect) da lanciare contro un'istanza attiva, per esempio `tests/groups_access.sh http://localhost/gym-progress-tracker/backend/`. Registrano account usa e getta e li cancellano alla fine: vanno usati su un'istanza locale o di prova, **mai in produzione**.

### Blog (facoltativo)

Il motore PHP sta in `blog/`; gli articoli sono file Markdown in `blog/content/`, che non fanno parte del repository. Formato e test in locale in [`blog/content/README.md`](blog/content/README.md).

## Setup e aggiornamento del database

### Installazione pulita (repo scaricata da zero)

Importa **`backend/database/gym_progress_tracker.sql`** e basta. Contiene lo schema unificato completo: autenticazione (inclusi i token API mobile e il recupero password), schede, storico, serie relazionali, body stats, gamification (streak settimanale, XP, livelli, progressione per esercizio, achievement), gruppi, consensi dell'utente, rate limiting ed esercizi di base.

### Aggiornare un database esistente

Per aggiornare un database preesistente creato con le versioni precedenti, esegui:

* **`backend/database/schema_alter_migrations.sql`**: sezioni numerate e cumulative. Contiene gli `ALTER TABLE` (campi profilo utente e recupero, note, tecniche di intensità, gamification, timestamp cambio password, ultimo accesso, dati da Apple Salute / Health Connect, durata dell'allenamento, esercizi personali con stato di approvazione, ruolo admin), più i `CREATE TABLE IF NOT EXISTS` idempotenti per le tabelle introdotte dopo la release iniziale (cronologia/set, gamification, rate limiting, token API mobile, recupero password, consensi, gruppi). Ogni sezione va eseguita una volta sola: gli `ALTER` non sono idempotenti.

Quando un rilascio aggiunge una sezione, si aggiungono solo colonne e tabelle e si tolgono le vecchie in un rilascio successivo: così la versione precedente continua a funzionare con lo schema nuovo.

## Autore

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

Se trovi utile questo progetto, lascia una ⭐ sulla repository!
