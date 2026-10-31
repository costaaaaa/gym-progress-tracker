<?php
require_once __DIR__ . '/../lib/plan_sets_rules.php';

class WorkoutExercise
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_exercises";

    // Object properties
    public $id;
    public $day_id;
    public $exercise_id;
    public $rest;
    public $notes;
    // Serie pianificate nella forma di planned_sets_normalize() (scrittura) o planned_set_from_row() (lettura)
    public $planned_sets;
    public $created_at;
    public $updated_at;

    // Exercise details
    public $exercise_name;
    public $muscle_group;
    public $equipment;

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
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        // Niente htmlspecialchars sul testo libero: l'escape lo fa chi lo mostra (vedi Exercise::create)
        $this->notes = isset($this->notes) ? trim((string)$this->notes) : null;

        // Inserimento: l'esercizio va in fondo al giorno (position = massimo + 1)
        // :day_id e :position_day_id sono lo stesso valore: PDO non accetta lo stesso segnaposto due volte
        $query = "INSERT INTO " . $this->table_name . "
                    (day_id, exercise_id, position, rest, notes)
                SELECT :day_id, :exercise_id, COALESCE(MAX(position), 0) + 1, :rest, :notes
                FROM " . $this->table_name . "
                WHERE day_id = :position_day_id";

        try {
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":day_id", $this->day_id);
            $stmt->bindParam(":position_day_id", $this->day_id);
            $stmt->bindParam(":exercise_id", $this->exercise_id);
            $stmt->bindParam(":rest", $this->rest);
            $stmt->bindParam(":notes", $this->notes);
            $stmt->execute();
            $this->id = $this->conn->lastInsertId();

            $this->replacePlannedSets();
            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Errore nella creazione dell'esercizio in scheda: " . $e->getMessage());
            return false;
        }
    }

    // Read all exercises for a workout day, each with its planned_sets
    public function readByDay()
    {
        // Query to read all records with exercise details
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.rest, we.notes,
                    we.created_at, we.updated_at, " . exercise_name_sql() . " as exercise_name, e.muscle_group
                FROM " . $this->table_name . " we
                LEFT JOIN gym_exercises e ON we.exercise_id = e.id
                WHERE we.day_id = ?
                ORDER BY we.position ASC, we.id ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->day_id);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $sets_by_exercise = self::plannedSetsByExercises($this->conn, array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['planned_sets'] = $sets_by_exercise[$row['id']] ?? array();
        }
        unset($row);

        return $rows;
    }

    // Read one workout exercise
    public function readOne()
    {
        // Query to read single record with exercise details
        $query = "SELECT we.id, we.day_id, we.exercise_id, we.rest, we.notes,
                    we.created_at, we.updated_at, " . exercise_name_sql() . " as exercise_name, e.muscle_group, e.equipment
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
            $this->rest = $row['rest'];
            $this->notes = $row['notes'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            $this->exercise_name = $row['exercise_name'];
            $this->muscle_group = $row['muscle_group'];
            $this->equipment = $row['equipment'];
            $this->planned_sets = self::plannedSetsByExercises($this->conn, array($this->id))[$this->id] ?? array();
            return true;
        }

        return false;
    }

    // Update workout exercise: recupero, note e serie pianificate (queste ultime sostituite per intero)
    public function update()
    {
        // Sanitize inputs
        $this->rest = htmlspecialchars(strip_tags($this->rest));
        $this->notes = isset($this->notes) ? trim((string)$this->notes) : null;
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    rest = :rest,
                    notes = :notes
                WHERE id = :id";

        try {
            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":rest", $this->rest);
            $stmt->bindParam(":notes", $this->notes);
            $stmt->bindParam(":id", $this->id);
            $stmt->execute();

            $this->replacePlannedSets();
            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollback();
            }
            error_log("Errore nell'aggiornamento dell'esercizio in scheda: " . $e->getMessage());
            return false;
        }
    }

    // Sostituisce tutte le serie dell'esercizio con $this->planned_sets (già validate e normalizzate).
    // Da chiamare dentro una transazione.
    private function replacePlannedSets()
    {
        $delete = $this->conn->prepare("DELETE FROM gym_workout_plan_sets WHERE workout_exercise_id = ?");
        $delete->execute(array($this->id));

        $placeholders = implode(',', array_fill(0, count($this->planned_sets), '(?, ?, ?, ?, ?, ?, ?)'));
        $values = array();
        foreach ($this->planned_sets as $set) {
            array_push(
                $values,
                $this->id,
                $set['set_number'],
                $set['kind'],
                $set['reps_min'],
                $set['reps_max'],
                $set['to_failure'] ? 1 : 0,
                $set['intensity_technique']
            );
        }
        $insert = $this->conn->prepare(
            "INSERT INTO gym_workout_plan_sets
                (workout_exercise_id, set_number, kind, reps_min, reps_max, to_failure, intensity_technique)
             VALUES $placeholders"
        );
        $insert->execute($values);
    }

    /**
     * Le serie pianificate degli esercizi indicati (id di gym_workout_exercises), con una sola query:
     * [id => lista di planned_set_from_row(), in ordine di set_number]. Un esercizio senza serie manca.
     */
    public static function plannedSetsByExercises($db, array $workout_exercise_ids)
    {
        $sets_by_exercise = array();
        if (count($workout_exercise_ids) === 0) {
            return $sets_by_exercise;
        }
        $placeholders = implode(',', array_fill(0, count($workout_exercise_ids), '?'));
        $stmt = $db->prepare(
            "SELECT workout_exercise_id, set_number, kind, reps_min, reps_max, to_failure, intensity_technique
             FROM gym_workout_plan_sets
             WHERE workout_exercise_id IN ($placeholders)
             ORDER BY workout_exercise_id ASC, set_number ASC"
        );
        foreach (array_values($workout_exercise_ids) as $index => $id) {
            $stmt->bindValue($index + 1, $id, PDO::PARAM_INT);
        }
        $stmt->execute();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sets_by_exercise[$row['workout_exercise_id']][] = planned_set_from_row($row);
        }
        return $sets_by_exercise;
    }

    /**
     * Un esercizio di scheda nella forma che restituiscono read_plans, add_exercise e update_exercise.
     * $row ha id, exercise_id, exercise_name, muscle_group, equipment, rest, notes.
     */
    public static function toResponse(array $row, array $planned_sets)
    {
        return array(
            "id" => $row["id"],
            "exercise_id" => $row["exercise_id"],
            "exercise_name" => $row["exercise_name"],
            "muscle_group" => $row["muscle_group"],
            "equipment" => $row["equipment"],
            "rest" => $row["rest"],
            "notes" => $row["notes"] ?? "",
            "planned_sets" => $planned_sets
        );
    }

    // Questo esercizio (dopo readOne()) nella forma di toResponse()
    public function response()
    {
        return self::toResponse(array(
            "id" => $this->id,
            "exercise_id" => $this->exercise_id,
            "exercise_name" => $this->exercise_name,
            "muscle_group" => $this->muscle_group,
            "equipment" => $this->equipment,
            "rest" => $this->rest,
            "notes" => $this->notes
        ), $this->planned_sets);
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

    /** Sposta un esercizio una posizione in alto nel giorno. */
    public function moveUp()
    {
        return $this->moveWithinDay('up');
    }

    /** Sposta un esercizio una posizione in basso nel giorno. */
    public function moveDown()
    {
        return $this->moveWithinDay('down');
    }

    /**
     * Scambia l'esercizio con il vicino nell'ordine (position, id) del giorno, rinumera il giorno
     * 1..n e scrive solo le righe la cui position cambia. Cambiano solo le position: ogni riga
     * resta legata al suo esercizio. Le righe del giorno sono bloccate con FOR UPDATE, così due
     * riordini simultanei non si sovrappongono. Primo su / ultimo giù: niente da fare, true.
     *
     * @return boolean true se l'operazione ha successo, false altrimenti
     */
    private function moveWithinDay($direction)
    {
        try {
            $this->id = htmlspecialchars(strip_tags($this->id));
            $this->day_id = htmlspecialchars(strip_tags($this->day_id));

            $this->conn->beginTransaction();

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

            // Con position già 1..n sono 2 UPDATE; con buchi o pareggi il giorno si rimette in ordine
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
