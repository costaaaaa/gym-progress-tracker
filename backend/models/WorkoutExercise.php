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
    public $warmup_sets;
    public $reps;
    public $rest;
    public $notes;
    public $intensity_technique;
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
        $this->warmup_sets = htmlspecialchars(strip_tags($this->warmup_sets ?? 0));
        // Niente htmlspecialchars sul testo libero: l'escape lo fa chi lo mostra (vedi Exercise::create)
        $this->reps = trim((string)$this->reps);
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        $this->notes = isset($this->notes) ? trim((string)$this->notes) : null;
        $this->intensity_technique = isset($this->intensity_technique) ? trim((string)$this->intensity_technique) : null;

        // Inserimento: l'esercizio va in fondo al giorno (position = massimo + 1)
        // :day_id e :position_day_id sono lo stesso valore: PDO non accetta lo stesso segnaposto due volte
        $query = "INSERT INTO " . $this->table_name . "
                    (day_id, exercise_id, position, sets, warmup_sets, reps, rest, notes, intensity_technique)
                SELECT :day_id, :exercise_id, COALESCE(MAX(position), 0) + 1, :sets, :warmup_sets, :reps, :rest, :notes, :intensity_technique
                FROM " . $this->table_name . "
                WHERE day_id = :position_day_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":day_id", $this->day_id);
        $stmt->bindParam(":position_day_id", $this->day_id);
        $stmt->bindParam(":exercise_id", $this->exercise_id);
        $stmt->bindParam(":sets", $this->sets);
        $stmt->bindParam(":warmup_sets", $this->warmup_sets);
        $stmt->bindParam(":reps", $this->reps);
        $stmt->bindParam(":rest", $this->rest);
        $stmt->bindParam(":notes", $this->notes);
        $stmt->bindParam(":intensity_technique", $this->intensity_technique);

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
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.sets, we.warmup_sets, we.reps, we.rest, we.notes, we.intensity_technique,
                    we.created_at, we.updated_at, " . exercise_name_sql() . " as exercise_name, e.muscle_group
                FROM " . $this->table_name . " we
                LEFT JOIN gym_exercises e ON we.exercise_id = e.id
                WHERE we.day_id = ?
                ORDER BY we.position ASC, we.id ASC";

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
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.sets, we.warmup_sets, we.reps, we.rest, we.notes, we.intensity_technique,
                    we.created_at, we.updated_at, " . exercise_name_sql() . " as exercise_name, e.muscle_group
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
            $this->warmup_sets = $row['warmup_sets'];
            $this->reps = $row['reps'];
            $this->rest = $row['rest'];
            $this->notes = $row['notes'];
            $this->intensity_technique = $row['intensity_technique'];
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
        $this->warmup_sets = htmlspecialchars(strip_tags($this->warmup_sets ?? 0));
        $this->reps = trim((string)$this->reps);
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        $this->notes = isset($this->notes) ? trim((string)$this->notes) : null;
        $this->intensity_technique = isset($this->intensity_technique) ? trim((string)$this->intensity_technique) : null;
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    sets = :sets,
                    warmup_sets = :warmup_sets,
                    reps = :reps,
                    rest = :rest,
                    notes = :notes,
                    intensity_technique = :intensity_technique
                WHERE id = :id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":sets", $this->sets);
        $stmt->bindParam(":warmup_sets", $this->warmup_sets);
        $stmt->bindParam(":reps", $this->reps);
        $stmt->bindParam(":rest", $this->rest);
        $stmt->bindParam(":notes", $this->notes);
        $stmt->bindParam(":intensity_technique", $this->intensity_technique);
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
     * Sposta un esercizio una posizione in alto (diminuisce la position).
     * Cambia solo le position: ogni riga resta legata al suo esercizio. Il giorno viene
     * rinumerato 1..n e si scrivono solo le righe la cui position cambia.
     *
     * @return boolean true se l'operazione ha successo, false altrimenti
     */
    public function moveUp()
    {
        return $this->swapPositionWithNeighbour('up');
    }

    /**
     * Sposta un esercizio una posizione in basso (aumenta la position).
     *
     * @return boolean true se l'operazione ha successo, false altrimenti
     */
    public function moveDown()
    {
        return $this->swapPositionWithNeighbour('down');
    }

    // Il vicino è il precedente/successivo nell'ordine (position, id) del giorno
    private function swapPositionWithNeighbour($direction)
    {
        try {
            $this->id = htmlspecialchars(strip_tags($this->id));
            $this->day_id = htmlspecialchars(strip_tags($this->day_id));

            $this->conn->beginTransaction();

            // Blocca le righe del giorno: due riordini simultanei non si sovrappongono
            $stmt = $this->conn->prepare(
                "SELECT id, position FROM " . $this->table_name . "
                 WHERE day_id = :day_id
                 ORDER BY position ASC, id ASC
                 FOR UPDATE"
            );
            $stmt->bindParam(':day_id', $this->day_id);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $index = null;
            foreach ($rows as $i => $row) {
                if ((int) $row['id'] === (int) $this->id) {
                    $index = $i;
                    break;
                }
            }
            if ($index === null) {
                // Eliminato nel frattempo (l'appartenenza l'ha già verificata il controller)
                $this->conn->rollback();
                return false;
            }
            $neighbour_index = $direction === 'up' ? $index - 1 : $index + 1;
            if (!isset($rows[$neighbour_index])) {
                // Già in cima (o in fondo): niente da fare
                $this->conn->rollback();
                return true;
            }

            // Scambia i due nell'ordine, rinumera il giorno 1..n e scrive solo le righe cambiate:
            // con position già 1..n sono 2 UPDATE, con buchi o pareggi il giorno si rimette in ordine
            $swapped = $rows[$index];
            $rows[$index] = $rows[$neighbour_index];
            $rows[$neighbour_index] = $swapped;

            $update = $this->conn->prepare("UPDATE " . $this->table_name . " SET position = :position WHERE id = :id");
            foreach ($rows as $i => $row) {
                if ((int) $row['position'] !== $i + 1) {
                    $update->execute(array(':position' => $i + 1, ':id' => $row['id']));
                }
            }

            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Errore nel riordino ($direction): " . $e->getMessage());
            return false;
        }
    }
}
