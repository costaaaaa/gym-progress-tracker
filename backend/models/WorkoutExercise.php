<?php
class WorkoutExercise
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_exercises";

    // Object properties
    public $id;
    public $day_id;
    public $exercise_id;
    public $sets;
    public $reps;
    public $rest;
    public $notes;
    public $created_at;
    public $updated_at;

    // Exercise details
    public $exercise_name;
    public $muscle_group;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Create new workout exercise
    public function create()
    {
        // Sanitize inputs
        $this->day_id = htmlspecialchars(strip_tags($this->day_id));
        $this->exercise_id = htmlspecialchars(strip_tags($this->exercise_id));
        $this->sets = htmlspecialchars(strip_tags($this->sets));
        $this->reps = htmlspecialchars(strip_tags($this->reps));
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        $this->notes = isset($this->notes) ? htmlspecialchars(strip_tags($this->notes)) : null;

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    day_id = :day_id,
                    exercise_id = :exercise_id,
                    sets = :sets,
                    reps = :reps,
                    rest = :rest,
                    notes = :notes";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":day_id", $this->day_id);
        $stmt->bindParam(":exercise_id", $this->exercise_id);
        $stmt->bindParam(":sets", $this->sets);
        $stmt->bindParam(":reps", $this->reps);
        $stmt->bindParam(":rest", $this->rest);
        $stmt->bindParam(":notes", $this->notes);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Read all exercises for a workout day
    public function readByDay()
    {
        // Query to read all records with exercise details
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.sets, we.reps, we.rest, we.notes, 
                    we.created_at, we.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " we
                LEFT JOIN gym_exercises e ON we.exercise_id = e.id
                WHERE we.day_id = ?
                ORDER BY we.id ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind day ID
        $stmt->bindParam(1, $this->day_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one workout exercise
    public function readOne()
    {
        // Query to read single record with exercise details
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.sets, we.reps, we.rest, we.notes, 
                    we.created_at, we.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " we
                LEFT JOIN gym_exercises e ON we.exercise_id = e.id
                WHERE we.id = ?
                LIMIT 0,1";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind ID
        $stmt->bindParam(1, $this->id);

        // Execute query
        $stmt->execute();

        // Get retrieved row
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            // Set values to object properties
            $this->id = $row['id'];
            $this->day_id = $row['day_id'];
            $this->exercise_id = $row['exercise_id'];
            $this->sets = $row['sets'];
            $this->reps = $row['reps'];
            $this->rest = $row['rest'];
            $this->notes = $row['notes'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            $this->exercise_name = $row['exercise_name'];
            $this->muscle_group = $row['muscle_group'];
            return true;
        }

        return false;
    }

    // Update workout exercise
    public function update()
    {
        // Sanitize inputs
        $this->sets = htmlspecialchars(strip_tags($this->sets));
        $this->reps = htmlspecialchars(strip_tags($this->reps));
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        $this->notes = isset($this->notes) ? htmlspecialchars(strip_tags($this->notes)) : null;
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    sets = :sets,
                    reps = :reps,
                    rest = :rest,
                    notes = :notes
                WHERE id = :id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":sets", $this->sets);
        $stmt->bindParam(":reps", $this->reps);
        $stmt->bindParam(":rest", $this->rest);
        $stmt->bindParam(":notes", $this->notes);
        $stmt->bindParam(":id", $this->id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete workout exercise
    public function delete()
    {
        // Query to delete record
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize inputs
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Bind values
        $stmt->bindParam(1, $this->id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    /**
     * Sposta un esercizio una posizione in alto (diminuire l'ordine)
     * Note: Questo metodo presuppone che l'ordinamento sia basato sull'ID (record più vecchio = più in alto)
     * Se si implementa una colonna "position", il metodo deve essere modificato
     * 
     * @return boolean true se l'operazione ha successo, false altrimenti
     */
    public function moveUp()
    {
        try {
            // Sanitize inputs
            $this->id = htmlspecialchars(strip_tags($this->id));
            $this->day_id = htmlspecialchars(strip_tags($this->day_id));

            // Troviamo l'esercizio precedente nello stesso giorno
            $query = "SELECT id FROM " . $this->table_name . "
                      WHERE day_id = :day_id AND id < :current_id
                      ORDER BY id DESC
                      LIMIT 1";

            error_log("Ricerca esercizio precedente: day_id={$this->day_id}, current_id={$this->id}");

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':day_id', $this->day_id);
            $stmt->bindParam(':current_id', $this->id);
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                // Non ci sono esercizi sopra questo, quindi è già in cima
                error_log("Nessun esercizio trovato sopra l'esercizio {$this->id}, è già in cima");
                return true;
            }

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $previous_id = $row['id'];

            error_log("Esercizio precedente trovato con ID: {$previous_id}");

            // Leggiamo i dati dei due esercizi da scambiare
            // Primo esercizio (corrente)
            $query = "SELECT * FROM " . $this->table_name . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $this->id);
            $stmt->execute();
            $current_exercise = $stmt->fetch(PDO::FETCH_ASSOC);

            // Secondo esercizio (precedente)
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $previous_id);
            $stmt->execute();
            $previous_exercise = $stmt->fetch(PDO::FETCH_ASSOC);

            // Inizia una transazione per garantire l'integrità dei dati
            $this->conn->beginTransaction();

            // Aggiorna il primo esercizio con i dati del secondo
            $query = "UPDATE " . $this->table_name . " SET 
                      exercise_id = :exercise_id,
                      sets = :sets,
                      reps = :reps,
                      rest = :rest,
                      notes = :notes
                      WHERE id = :id";

            // Update esercizio corrente
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':exercise_id', $previous_exercise['exercise_id']);
            $stmt->bindParam(':sets', $previous_exercise['sets']);
            $stmt->bindParam(':reps', $previous_exercise['reps']);
            $stmt->bindParam(':rest', $previous_exercise['rest']);
            $stmt->bindParam(':notes', $previous_exercise['notes']);
            $stmt->bindParam(':id', $this->id);
            $stmt->execute();

            // Update esercizio precedente
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':exercise_id', $current_exercise['exercise_id']);
            $stmt->bindParam(':sets', $current_exercise['sets']);
            $stmt->bindParam(':reps', $current_exercise['reps']);
            $stmt->bindParam(':rest', $current_exercise['rest']);
            $stmt->bindParam(':notes', $current_exercise['notes']);
            $stmt->bindParam(':id', $previous_id);
            $stmt->execute();

            // Commit della transazione
            $this->conn->commit();
            error_log("Scambio completato con successo tra esercizi {$this->id} e {$previous_id}");
            return true;
        } catch (Exception $e) {
            // Rollback in caso di errore
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Errore in moveUp: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Sposta un esercizio una posizione in basso (aumentare l'ordine)
     * Note: Questo metodo presuppone che l'ordinamento sia basato sull'ID (record più recente = più in basso)
     * Se si implementa una colonna "position", il metodo deve essere modificato
     * 
     * @return boolean true se l'operazione ha successo, false altrimenti
     */
    public function moveDown()
    {
        try {
            // Sanitize inputs
            $this->id = htmlspecialchars(strip_tags($this->id));
            $this->day_id = htmlspecialchars(strip_tags($this->day_id));

            // Troviamo l'esercizio successivo nello stesso giorno
            $query = "SELECT id FROM " . $this->table_name . "
                      WHERE day_id = :day_id AND id > :current_id
                      ORDER BY id ASC
                      LIMIT 1";

            error_log("Ricerca esercizio successivo: day_id={$this->day_id}, current_id={$this->id}");

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':day_id', $this->day_id);
            $stmt->bindParam(':current_id', $this->id);
            $stmt->execute();

            if ($stmt->rowCount() === 0) {
                // Non ci sono esercizi sotto questo, quindi è già in fondo
                error_log("Nessun esercizio trovato sotto l'esercizio {$this->id}, è già in fondo");
                return true;
            }

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $next_id = $row['id'];

            error_log("Esercizio successivo trovato con ID: {$next_id}");

            // Leggiamo i dati dei due esercizi da scambiare
            // Primo esercizio (corrente)
            $query = "SELECT * FROM " . $this->table_name . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $this->id);
            $stmt->execute();
            $current_exercise = $stmt->fetch(PDO::FETCH_ASSOC);

            // Secondo esercizio (successivo)
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $next_id);
            $stmt->execute();
            $next_exercise = $stmt->fetch(PDO::FETCH_ASSOC);

            // Inizia una transazione per garantire l'integrità dei dati
            $this->conn->beginTransaction();

            // Aggiorna il primo esercizio con i dati del secondo
            $query = "UPDATE " . $this->table_name . " SET 
                      exercise_id = :exercise_id,
                      sets = :sets,
                      reps = :reps,
                      rest = :rest,
                      notes = :notes
                      WHERE id = :id";

            // Update esercizio corrente
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':exercise_id', $next_exercise['exercise_id']);
            $stmt->bindParam(':sets', $next_exercise['sets']);
            $stmt->bindParam(':reps', $next_exercise['reps']);
            $stmt->bindParam(':rest', $next_exercise['rest']);
            $stmt->bindParam(':notes', $next_exercise['notes']);
            $stmt->bindParam(':id', $this->id);
            $stmt->execute();

            // Update esercizio successivo
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':exercise_id', $current_exercise['exercise_id']);
            $stmt->bindParam(':sets', $current_exercise['sets']);
            $stmt->bindParam(':reps', $current_exercise['reps']);
            $stmt->bindParam(':rest', $current_exercise['rest']);
            $stmt->bindParam(':notes', $current_exercise['notes']);
            $stmt->bindParam(':id', $next_id);
            $stmt->execute();

            // Commit della transazione
            $this->conn->commit();
            error_log("Scambio completato con successo tra esercizi {$this->id} e {$next_id}");
            return true;
        } catch (Exception $e) {
            // Rollback in caso di errore
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Errore in moveDown: " . $e->getMessage());
            return false;
        }
    }
}
