# Gym Progress Tracker

[🇮🇹 Versione Italiana](#-italiano) | [🇬🇧 English Version](#gym-progress-tracker)

# 🇬🇧 English

## Description

**Gym Progress Tracker** is a web application designed for those who want to keep track of their gym workouts in a simple, flexible, and detailed way.

With this tool you can:

* Create and manage an unlimited number of **workout plans**;
* Add exercises and training sessions to the active plan;
* View **detailed statistics** on the progress of exercises over time;
* Calculate useful metrics such as:

  * Total volume
  * Total repetitions
  * Volume per set
  * Volume per repetition
  * A **progress index** based on multiple parameters;
* Explore your data through **interactive and clear charts**.

## Key Features

* ✅ Multi-plan management
* 🔥 **Focus Mode**: immersive interface for real-time workout tracking with rest timers
* 💾 **Autosave**: local persistence to prevent data loss in Focus Mode
* 📈 **Advanced Dashboard**: redesigned interface with interactive charts
* 📊 **Global Stats**: track workout frequency (weekly) and total volume (monthly)
* 👤 **Body Stats**: track body measurements and visualize progress
* 🏋️ Add and edit exercises
* 🎯 **Smart Progress**: detailed metrics (Volume, Avg Weight, Progress Index) for each exercise
* 📌 Ability to select an active workout plan
* 🔒 **Secure Authentication**: session-based login with server-side **bcrypt** password hashing

## Technologies Used

* **React (v18)** with **Vite**
* **Material UI (MUI)** for the user interface
* **Recharts** for data visualization
* **PHP** (Legacy PDO / Modern experimental with Eloquent)
* **MySQL** for data storage

## Security

* **Passwords are hashed server-side with bcrypt** (`password_hash` / `password_verify`); the plaintext is sent only over HTTPS and is never stored.
* **Transparent migration**: accounts created before this change are automatically re-hashed to bcrypt on their next successful login.
* **Session-based authentication** via PHP sessions; every request uses `credentials: 'include'`.

## Try it Out

You can test the app directly here: 👉 [Gym Progress Tracker Live](https://andreacostamagna.altervista.org/gym-progress-tracker-v2/)

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
4. Configure database access in the `backend/config/database.php` file;
5. Launch a local server (e.g., with XAMPP) and make sure the PHP files are correctly served.
6. Start the React app:
   ```bash
   npm start
   ```

## Database setup & updates

The complete schema lives in `backend/database/gym_progress_tracker.sql`. The other
`.sql` files in that folder are **incremental migrations**, kept only to upgrade older databases.

### Fresh install (cloned from scratch)

Import **`backend/database/gym_progress_tracker.sql`** and you are done. It already includes
everything: auth, workout plans, history, body stats, **gamification (weekly streak + XP, levels,
per-exercise progression, achievements)** and **rate limiting**. No other script is needed.

### Updating an existing database

Run only the migrations you have **not** applied yet, in this order (all in `backend/database/`):

| # | File | Adds |
|---|------|------|
| 1 | `add_notes_column.sql` | `notes` field on plan exercises |
| 2 | `create_history_table.sql` | workout history table |
| 3 | `database_update.sql` | per-set workout logging |
| 4 | `gamification_setup.sql` | weekly streak tracking |
| 5 | `gamification_levels_setup.sql` | XP, levels, per-exercise progression, achievements |
| 6 | `create_rate_limits_table.sql` | login/register rate limiting |

The `CREATE TABLE IF NOT EXISTS` migrations are safe to re-run. The `ALTER TABLE` ones (**1** and
**5**) must run **once** — re-running them throws a harmless "duplicate column" error you can ignore.

After step 5, gamification stats accumulate from **newly recorded** workouts. Seeding XP and
achievements from a user's existing history is optional and done with a one-time server-side script
(run locally; not included in the repository).

## Author

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

If you find this project useful, consider giving it a ⭐ on GitHub!

---

# 🇮🇹 Italiano

[🇬🇧 English Version](#gym-progress-tracker)

## Descrizione

**Gym Progress Tracker** è un'applicazione web pensata per chi desidera tenere traccia dei propri allenamenti in palestra in modo semplice, flessibile e dettagliato.

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
* Esplorare i dati tramite **grafici interattivi** e chiari.

## Funzionalità principali

* ✅ Gestione multi-scheda
* 🔥 **Modalità Focus**: interfaccia dedicata per l'allenamento in tempo reale con timer di recupero integrati
* 💾 **Autosave**: salvataggio locale automatico per non perdere mai i progressi in Focus Mode
* 📈 **Dashboard Avanzata**: interfaccia ridisegnata per una consultazione rapida e chiara
* 📊 **Statistiche Globali**: tracciamento frequenza (settimanale) e volume totale (mensile)
* 👤 **Body Stats**: tracciamento delle misure corporee e visualizzazione grafica
* 🏋️ Aggiunta e modifica di esercizi
* 🎯 **Progressi Mirati**: metriche di dettaglio (Volume, Peso Medio, Indice Progresso) per ogni singolo esercizio
* 📌 Possibilità di selezionare una scheda attiva
* 🔒 **Autenticazione sicura**: login basato su sessione con hashing **bcrypt** lato server

## Tecnologie utilizzate

* **React (v18)** con **Vite**
* **Material UI (MUI)** per l'interfaccia utente
* **Recharts** per la visualizzazione dei dati
* **PHP** (Legacy PDO / Moderno sperimentale con Eloquent)
* **MySQL** per il salvataggio dei dati utente

## Sicurezza

* **Le password sono hashate lato server con bcrypt** (`password_hash` / `password_verify`); il testo in chiaro viaggia solo su HTTPS e non viene mai memorizzato.
* **Migrazione trasparente**: gli account creati prima di questa modifica vengono ri-hashati automaticamente in bcrypt al primo login andato a buon fine.
* **Autenticazione basata su sessione** tramite sessioni PHP; ogni richiesta usa `credentials: 'include'`.

## Come provarlo

Puoi testare l'app direttamente al seguente link: 👉 [Gym Progress Tracker Live](https://andreacostamagna.altervista.org/gym-progress-tracker-v2/)

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
4. Configura i dati di accesso al database nel file `backend/config/database.php`;
5. Avvia il server locale (es. con XAMPP) e assicurati che i file PHP siano serviti correttamente.
6. Avvia l'app React:
   ```bash
   npm start
   ```

## Setup e aggiornamento del database

Lo schema completo è in `backend/database/gym_progress_tracker.sql`. Gli altri file `.sql` nella
stessa cartella sono **migration incrementali**, mantenute solo per aggiornare database più vecchi.

### Installazione pulita (repo scaricata da zero)

Importa **`backend/database/gym_progress_tracker.sql`** e basta. Contiene già tutto: autenticazione,
schede, storico, body stats, **gamification (streak settimanale + XP, livelli, progressione per
esercizio, achievement)** e **rate limiting**. Non serve eseguire altro.

### Aggiornare un database esistente

Esegui solo le migration che **non** hai ancora applicato, in quest'ordine (tutte in `backend/database/`):

| # | File | Aggiunge |
|---|------|----------|
| 1 | `add_notes_column.sql` | campo `notes` sugli esercizi della scheda |
| 2 | `create_history_table.sql` | tabella storico allenamenti |
| 3 | `database_update.sql` | registrazione per singolo set |
| 4 | `gamification_setup.sql` | streak settimanale |
| 5 | `gamification_levels_setup.sql` | XP, livelli, progressione per esercizio, achievement |
| 6 | `create_rate_limits_table.sql` | rate limiting su login/register |

Le migration `CREATE TABLE IF NOT EXISTS` si possono rieseguire senza rischi. Quelle `ALTER TABLE`
(**1** e **5**) vanno eseguite **una sola volta**: rieseguirle dà un innocuo errore "duplicate column"
che puoi ignorare.

Dopo lo step 5, le statistiche di gamification si accumulano dai nuovi allenamenti registrati. Il
ricalcolo di XP e achievement dallo storico esistente è opzionale e si fa con uno script una-tantum
lato server (eseguito in locale; non incluso nella repository).

## Autore

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

Se trovi utile questo progetto, lascia una ⭐ sulla repository!
