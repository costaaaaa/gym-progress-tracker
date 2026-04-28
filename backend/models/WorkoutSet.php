<?php
class WorkoutSet
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_sets";

    // Object properties
    public $id;
    public $workout_history_id;
    public $exercise_id;
    public $set_number;
    public $weight;
    public $reps;
    public $intensity_technique;

    // Extra properties for joins
    public $exercise_name;
    public $muscle_group;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Create a new workout set
    public function create()
    {
        try {
            $query = "INSERT INTO " . $this->table_name . "
                    SET
                        workout_history_id = :workout_history_id,
                        exercise_id = :exercise_id,
                        set_number = :set_number,
                        weight = :weight,
                        reps = :reps,
                        intensity_technique = :intensity_technique";

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Sanitize inputs
            $this->workout_history_id = htmlspecialchars(strip_tags($this->workout_history_id));
            $this->exercise_id = htmlspecialchars(strip_tags($this->exercise_id));
            $this->set_number = htmlspecialchars(strip_tags($this->set_number));
            $this->weight = htmlspecialchars(strip_tags($this->weight));
            $this->reps = htmlspecialchars(strip_tags($this->reps));
            $this->intensity_technique = isset($this->intensity_technique) ? htmlspecialchars(strip_tags($this->intensity_technique)) : null;

            // Bind values
            $stmt->bindParam(":workout_history_id", $this->workout_history_id);
            $stmt->bindParam(":exercise_id", $this->exercise_id);
            $stmt->bindParam(":set_number", $this->set_number);
            $stmt->bindParam(":weight", $this->weight);
            $stmt->bindParam(":reps", $this->reps);
            $stmt->bindParam(":intensity_technique", $this->intensity_technique);

            // Execute query
            if ($stmt->execute()) {
                $this->id = $this->conn->lastInsertId();
                return true;
            }

            return false;
        } catch (PDOException $e) {
            error_log("Database error during workout set creation: " . $e->getMessage());
            throw $e;
        }
    }

    // Read all sets for a specific user to optimize N+1 queries
    public function readAllByUserId($user_id)
    {
        $query = "SELECT ws.id, ws.workout_history_id, ws.exercise_id, ws.set_number, ws.weight, ws.reps, ws.intensity_technique,
                       e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " ws
                LEFT JOIN gym_exercises e ON ws.exercise_id = e.id
                JOIN gym_workout_history wh ON ws.workout_history_id = wh.id
                WHERE wh.user_id = ?
                ORDER BY wh.date DESC, ws.workout_history_id ASC, ws.id ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $user_id);
        $stmt->execute();

        return $stmt;
    }

    // Read all sets for a specific workout
    public function readByWorkoutId()
    {
        // Query to read sets with exercise info
        $query = "SELECT ws.id, ws.workout_history_id, ws.exercise_id, ws.set_number, ws.weight, ws.reps, ws.intensity_technique,
                       e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " ws
                LEFT JOIN gym_exercises e ON ws.exercise_id = e.id
                WHERE ws.workout_history_id = ?
                ORDER BY ws.id ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind workout ID
        $stmt->bindParam(1, $this->workout_history_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Group sets by exercise for a specific workout
    public function getExerciseSetsForWorkout()
    {
        // Call the readByWorkoutId method to get all sets
        $stmt = $this->readByWorkoutId();
        $sets = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Nuovo approccio: trattiamo ogni blocco contiguo di esercizi come un gruppo separato
        $result = [];
        $current_exercise = null;
        $current_group = null;
        $group_sequence = 0;  // Contatore per tenere traccia della sequenza dei gruppi
        
        // I set sono già ordinati per ID (ordine di inserimento) grazie alla query modificata
        foreach ($sets as $set) {
            $exercise_id = $set['exercise_id'];
            
            // Se è un nuovo esercizio o se abbiamo cambiato esercizio, iniziamo un nuovo gruppo
            if ($current_exercise !== $exercise_id) {
                // Se avevamo un gruppo attivo, salviamolo
                if ($current_group !== null) {
                    $result[] = $current_group;
                }
                
                // Creiamo un nuovo gruppo per questo esercizio
                $current_group = [
                    'exercise_id' => $exercise_id,
                    'exercise_name' => $set['exercise_name'],
                    'muscle_group' => $set['muscle_group'],
                    'sequence' => $group_sequence++,  // Assegniamo un numero di sequenza
                    'sets' => []
                ];
                
                $current_exercise = $exercise_id;
            }
            
            // Aggiungiamo questo set al gruppo corrente
            if ($current_group !== null) {
                $current_group['sets'][] = [
                    'set_number' => $set['set_number'],
                    'weight' => $set['weight'],
                    'reps' => $set['reps'],
                    'intensity_technique' => $set['intensity_technique']
                ];
            }
        }
        
        // Aggiungiamo l'ultimo gruppo attivo se esiste
        if ($current_group !== null) {
            $result[] = $current_group;
        }
        
        return $result;
    }

    // Update a workout set
    public function update()
    {
        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    exercise_id = :exercise_id,
                    set_number = :set_number,
                    weight = :weight,
                    reps = :reps,
                    intensity_technique = :intensity_technique
                WHERE id = :id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize inputs
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->exercise_id = htmlspecialchars(strip_tags($this->exercise_id));
        $this->set_number = htmlspecialchars(strip_tags($this->set_number));
        $this->weight = htmlspecialchars(strip_tags($this->weight));
        $this->reps = htmlspecialchars(strip_tags($this->reps));
        $this->intensity_technique = isset($this->intensity_technique) ? htmlspecialchars(strip_tags($this->intensity_technique)) : null;

        // Bind values
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":exercise_id", $this->exercise_id);
        $stmt->bindParam(":set_number", $this->set_number);
        $stmt->bindParam(":weight", $this->weight);
        $stmt->bindParam(":reps", $this->reps);
        $stmt->bindParam(":intensity_technique", $this->intensity_technique);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete a workout set
    public function delete()
    {
        // Query to delete record
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize input
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Bind value
        $stmt->bindParam(1, $this->id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete all sets for a specific workout
    public function deleteByWorkoutId()
    {
        // Query to delete all records for a workout
        $query = "DELETE FROM " . $this->table_name . " WHERE workout_history_id = ?";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize input
        $this->workout_history_id = htmlspecialchars(strip_tags($this->workout_history_id));

        // Bind value
        $stmt->bindParam(1, $this->workout_history_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }
} 