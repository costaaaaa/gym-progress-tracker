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
3. Import the MySQL database using the unified schema:
   * Use `backend/database/gym_progress_tracker.sql`
4. Configure database access in the `backend/config/database.php` file;
5. Launch a local server (e.g., with XAMPP) and make sure the PHP files are correctly served.
6. Start the React app:
   ```bash
   npm start
   ```

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
3. Importa il database MySQL usando lo schema unificato:
   * Usa il file `backend/database/gym_progress_tracker.sql`
4. Configura i dati di accesso al database nel file `backend/config/database.php`;
5. Avvia il server locale (es. con XAMPP) e assicurati che i file PHP siano serviti correttamente.
6. Avvia l'app React:
   ```bash
   npm start
   ```

## Autore

Andrea Costamagna
[GitHub](https://github.com/costaaaaa)

---

Se trovi utile questo progetto, lascia una ⭐ sulla repository!
