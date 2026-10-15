# Aggiornamento della struttura del database per Gym Progress Tracker

> **Documento storico.** Descrive la migrazione una tantum verso `gym_workout_sets`. Oggi la
> tabella è già nello schema completo (`backend/database/gym_progress_tracker.sql`) e nelle
> migrazioni cumulative (`backend/database/schema_alter_migrations.sql`): per installare o
> aggiornare il database segui la sezione "Setup e aggiornamento del database" del
> [README](README.md). Il file `database_update.sql` citato qui sotto non esiste più.

Questo aggiornamento risolve il problema degli ID inconsistenti degli esercizi tra le tabelle `gym_exercises` e `gym_workout_history` implementando una struttura relazionale più robusta.

## Panoramica dei cambiamenti

1. **Nuova tabella `gym_workout_sets`**
   - Memorizza ogni set di esercizi in modo relazionale
   - Si collega direttamente agli ID corretti in `gym_exercises`

2. **Modifica alle API**
   - L'API di registrazione degli allenamenti ora utilizza la nuova struttura
   - L'API di lettura supporta sia il vecchio che il nuovo formato (retrocompatibilità)

3. **Nuovo modello per i set di allenamento**
   - Aggiunto `WorkoutSet.php` per gestire i set di allenamento

## Istruzioni per l'aggiornamento

### 1. Backup del database

**IMPORTANTE**: Prima di procedere, esegui un backup completo del database.

```sql
mysqldump -u username -p database_name > backup_before_upgrade.sql
```

### 2. Creazione della nuova tabella

Esegui il seguente script SQL:

```sql
CREATE TABLE IF NOT EXISTS `gym_workout_sets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `workout_history_id` int(11) NOT NULL,
  `exercise_id` int(11) NOT NULL,
  `set_number` int(11) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `reps` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workout_history_id` (`workout_history_id`),
  KEY `exercise_id` (`exercise_id`),
  CONSTRAINT `gym_workout_sets_ibfk_1` FOREIGN KEY (`workout_history_id`) REFERENCES `gym_workout_history` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gym_workout_sets_ibfk_2` FOREIGN KEY (`exercise_id`) REFERENCES `gym_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Puoi utilizzare PHPMyAdmin o un altro client SQL, oppure copiare lo script `database_update.sql` nel tuo server.

### 3. Migrazione dei dati esistenti

1. Carica il file `migrate_workout_data.php` sul tuo server
2. Visita l'URL di questo script nel browser (es. `https://tuo-sito.com/migrate_workout_data.php`)
3. Controlla i log per verificare che la migrazione sia avvenuta con successo

Questo script:
- Legge tutti i record dalla tabella `gym_workout_history`
- Estrae gli esercizi dal campo JSON
- Cerca l'ID corretto di ogni esercizio nella tabella `gym_exercises`
- Inserisce i dati nella nuova tabella `gym_workout_sets`

### 4. Aggiornamento dei file del codice sorgente

Sostituisci i seguenti file:

1. `backend/models/WorkoutSet.php` (nuovo file)
2. `backend/api/workout/record_workout.php` (file modificato)
3. `backend/api/workout_history/read.php` (file modificato)
4. `src/components/RecordWorkoutDialog.js` (file modificato)

### 5. Test della nuova struttura

Dopo l'aggiornamento:

1. Prova a registrare un nuovo allenamento
2. Verifica che i dati appaiano correttamente nella pagina dei progressi
3. Controlla i log della console per verificare che gli ID degli esercizi siano corretti

## Sezione 21: XP annullabili

Aggiunge `gym_workout_rewards` e `gym_workout_exercise_rewards`: ogni allenamento salvato da ora registra
gli XP che ha dato, così cancellarlo li toglie (XP generali, XP e livello degli esercizi, volume,
achievement di sessioni, tonnellaggio e forza; il cooldown delle sessioni con XP riparte dall'ultima rimasta).

- **Allenamenti salvati prima del rilascio** non hanno righe nel registro: cancellarli **non cambia gli XP**.
  Il volume e gli achievement invece si ricalcolano dalle serie, come per gli altri.
- **Record**: un esercizio dà XP di record al massimo **una volta al giorno** (giorno dell'allenamento
  al salvataggio). Gli allenamenti già salvati non hanno righe, quindi il tetto vale dal primo
  salvataggio dopo il rilascio.
- Lo streak e i suoi achievement non si toccano qui: li segue la sezione 22.

## Sezione 22: streak reversibile

Aggiunge `gym_streak_weeks` (una riga per settimana chiusa, con l'obiettivo di quel momento) e la colonna
`gym_user_gamification.streak_floor_weeks`. Lo streak si ricava dalle settimane chiuse: cancellare o
spostare un allenamento può riaprire una settimana (−30 XP, streak ricalcolato, achievement di streak
tolti se non più raggiunti); salvarlo in ritardo o spostarlo può chiuderne una passata (+30 XP, lo
streak si riattacca). Il cambio data è ammesso solo entro 30 giorni, sia da dove parte sia dove arriva.

- **Ricostruzione**: non c'è uno script da lanciare. Il primo salvataggio, cancellazione o cambio data
  di ogni utente dopo il rilascio ricostruisce il suo registro (`streak_floor_weeks` NULL → valorizzato):
  tutta la serie in corso, le settimane degli ultimi 30 giorni che raggiungono l'obiettivo attuale e,
  come minimo dello streak massimo, quello salvato se viene da una serie vecchia. Nessun XP cambia.
- **Rollback del codice** sotto questa versione: il codice vecchio aggiorna lo streak senza il registro,
  che resta indietro. Tornando alla versione nuova va riallineato, così si ricostruisce da solo:
  `DELETE FROM gym_streak_weeks; UPDATE gym_user_gamification SET streak_floor_weeks = NULL;`

## Sezione 23: obiettivo settimanale scelto dall'utente

Aggiunge `gym_weekly_goal_changes`: l'utente può impostare da 1 a 7 allenamenti a settimana al posto del
default (giorni della scheda attiva, 3 senza scheda) e tornare al default. Un cambio fatto **lunedì o
martedì** vale dalla settimana in corso (e chiude subito la settimana se la raggiunge già); uno fatto da
mercoledì a domenica vale dal **lunedì successivo**, così non si abbassa l'obiettivo solo per salvare lo streak.

- Nessuna riga = default: gli utenti esistenti non cambiano. Alzare l'obiettivo non riapre settimane già
  chiuse (vale il minore fra obiettivo alla chiusura e attuale, come nella sezione 22).
- **Rollback del codice** sotto questa versione: la tabella resta, inutilizzata, e l'obiettivo torna il default.

## Risoluzione dei problemi

### Se gli allenamenti esistenti non appaiono correttamente:

1. Controlla se ci sono stati errori durante la migrazione
2. Verifica che la tabella `gym_workout_sets` contenga dati
3. Usa lo script `migrate_workout_data.php` per visualizzare dettagli sul processo di migrazione

### Se i nuovi allenamenti non vengono salvati:

1. Verifica i log della console del browser
2. Controlla i log di errore del server PHP
3. Assicurati che gli ID degli esercizi che stai salvando esistano nella tabella `gym_exercises`

## Supporto

Se riscontri problemi durante l'aggiornamento, verifica i log del server e la console del browser per identificare il punto esatto dell'errore. 