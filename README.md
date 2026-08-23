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
* 🔥 **Focus Mode**: immersive interface for real-time workout tracking with rest timers and haptic feedback
* 💾 **Autosave**: local persistence to prevent data loss in Focus Mode
* 📈 **Advanced Dashboard**: hub-based interface with interactive charts (Workout Progress & Body Stats)
* 📊 **Global Stats**: track workout frequency (weekly) and total volume (monthly)
* 👤 **Body Stats**: track body measurements, circumferences, and visualize progress
* 🏆 **Gamification**: XP points, athlete levels, per-exercise mastery, weekly streaks, and unlockable achievements
* 🩺 **Muscle Recovery Visualizer**: anatomical map displaying muscle fatigue and recovery state
* 🍎 **Apple Health Sync**: automated weight synchronization via iOS Shortcuts
* 🏋️ Add and edit exercises with intensity techniques (Drop sets, Rest-pause, Super sets)
* 🎯 **Smart Progress**: detailed metrics (Volume, Avg Weight, Estimated 1RM, Progress Index) for each exercise
* 📌 Ability to select an active workout plan
* 🔒 **Secure Authentication**: session-based login with server-side **bcrypt** password hashing and rate limiting
* 🌓 **Dark & Light Mode**: custom theme with persistent appearance toggle

## Technologies Used

* **React (v18)** with **Vite**
* **Material UI (MUI)** for the user interface
* **Recharts** for data visualization
* **PHP** (PDO REST API architecture)
* **MySQL** for data storage

## Security

* **Passwords are hashed server-side with bcrypt** (`password_hash` / `password_verify`); the plaintext is sent only over HTTPS and is never stored.
* **Transparent migration**: accounts created before this change are automatically re-hashed to bcrypt on their next successful login.
* **Session-based authentication** via PHP sessions; every request uses `credentials: 'include'`.
* **Rate limiting** on authentication endpoints to prevent brute-force attacks.

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
4. Configure database access in the `backend/config/database.php` file (copy from `backend/config/database.php.example`);
5. Launch a local server (e.g., with XAMPP) and make sure the PHP files are correctly served.
6. Start the React app:
   ```bash
   npm start
   ```

## Database setup & updates

### Fresh install (cloned from scratch)

Import **`backend/database/gym_progress_tracker.sql`** and you are done. It includes the complete unified schema: auth, workout plans, history, relational sets, body stats, gamification (weekly streak, XP, levels, exercise progression, achievements), rate limiting, and default exercises.

### Updating an existing database

To upgrade an older database instance, execute:

* **`backend/database/schema_alter_migrations.sql`**: contains all cumulative `ALTER TABLE` statements (user profile and recovery fields, notes, intensity techniques, gamification XP/levels, and password change timestamps), plus idempotent `CREATE TABLE IF NOT EXISTS` statements for tables introduced after the initial release (workout history/sets, gamification, rate limiting) for instances that predate them.

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
* 🔥 **Modalità Focus**: interfaccia dedicata per l'allenamento in tempo reale con timer di recupero integrati e feedback aptico
* 💾 **Autosave**: salvataggio locale automatico per non perdere mai i progressi in Focus Mode
* 📈 **Dashboard Avanzata**: interfaccia a hub per una consultazione rapida e chiara (Progressi Workout e Misure Corporee)
* 📊 **Statistiche Globali**: tracciamento frequenza (settimanale) e volume totale (mensile)
* 👤 **Body Stats**: tracciamento delle misure corporee, circonferenze e visualizzazione grafica
* 🏆 **Gamification**: punti XP, livello atleta, maestria per singolo esercizio, streak settimanale e achievement sbloccabili
* 🩺 **Visualizzatore Recupero Muscolare**: mappa anatomica per monitorare l'affaticamento e il recupero dei gruppi muscolari
* 🍎 **Apple Health Sync**: sincronizzazione automatica del peso corporeo tramite Comandi Rapidi di iOS
* 🏋️ Aggiunta e modifica di esercizi con supporto a tecniche di intensità (Drop set, Rest-pause, Super set)
* 🎯 **Progressi Mirati**: metriche di dettaglio (Volume, Peso Medio, 1RM Stimato, Indice Progresso) per ogni singolo esercizio
* 📌 Possibilità di selezionare una scheda attiva
* 🔒 **Autenticazione sicura**: login basato su sessione con hashing **bcrypt** lato server e rate limiting
* 🌓 **Tema Chiaro / Scuro**: supporto al cambio tema personalizzato persistente

## Tecnologie utilizzate

* **React (v18)** con **Vite**
* **Material UI (MUI)** per l'interfaccia utente
* **Recharts** per la visualizzazione dei dati
* **PHP** (Architettura REST API con PDO)
* **MySQL** per il salvataggio dei dati utente

## Sicurezza

* **Le password sono hashate lato server con bcrypt** (`password_hash` / `password_verify`); il testo in chiaro viaggia solo su HTTPS e non viene mai memorizzato.
* **Migrazione trasparente**: gli account creati prima di questa modifica vengono ri-hashati automaticamente in bcrypt al primo login andato a buon fine.
* **Autenticazione basata su sessione** tramite sessioni PHP; ogni richiesta usa `credentials: 'include'`.
* **Rate limiting** sugli endpoint di autenticazione per mitigare attacchi brute-force.

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
4. Configura i dati di accesso al database nel file `backend/config/database.php` (copiando da `backend/config/database.php.example`);
5. Avvia il server locale (es. con XAMPP) e assicurati che i file PHP siano serviti correttamente.
6. Avvia l'app React:
   ```bash
   npm start
   ```

## Setup e aggiornamento del database

### Installazione pulita (repo scaricata da zero)

Importa **`backend/database/gym_progress_tracker.sql`** e basta. Contiene lo schema unificato completo: autenticazione, schede, storico, serie relazionali, body stats, gamification (streak settimanale, XP, livelli, progressione per esercizio, achievement), rate limiting ed esercizi di base.

### Aggiornare un database esistente

Per aggiornare un database preesistente creato con le versioni precedenti, esegui:

* **`backend/database/schema_alter_migrations.sql`**: contiene tutti gli `ALTER TABLE` cumulativi (campi profilo utente e recupero, note, tecniche di intensità, estensioni XP/livelli gamification e timestamp cambio password), più i `CREATE TABLE IF NOT EXISTS` idempotenti per le tabelle introdotte dopo la release iniziale (cronologia/set allenamenti, gamification, rate limiting) per le installazioni precedenti a queste.

## Autore

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

Se trovi utile questo progetto, lascia una ⭐ sulla repository!

