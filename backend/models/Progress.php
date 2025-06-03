<?php
class Progress {
    // Database connection and table name
    private $conn;
    private $table_name = "gym_progress";

    // Object properties
    public $id;
    public $user_id;
    public $exercise_id;
    public $weight;
    public $date;
    public $created_at;
    public $updated_at;
    
    // Exercise details
    public $exercise_name;
    public $muscle_group;

    // Constructor with database connection
    public function __construct($db) {
        $this->conn = $db;
    }

    // Create new progress record
    public function create() {
        // Sanitize inputs
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));
        $this->exercise_id = htmlspecialchars(strip_tags($this->exercise_id));
        $this->weight = htmlspecialchars(strip_tags($this->weight));
        $this->date = htmlspecialchars(strip_tags($this->date));

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    user_id = :user_id,
                    exercise_id = :exercise_id,
                    weight = :weight,
                    date = :date";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":user_id", $this->user_id);
        $stmt->bindParam(":exercise_id", $this->exercise_id);
        $stmt->bindParam(":weight", $this->weight);
        $stmt->bindParam(":date", $this->date);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Read all progress records for a user and exercise
    public function readByUserAndExercise() {
        // Query to read all records with exercise details
        $query = "SELECT p.id, p.user_id, p.exercise_id, p.weight, p.date, 
                    p.created_at, p.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " p
                LEFT JOIN gym_exercises e ON p.exercise_id = e.id
                WHERE p.user_id = ? AND p.exercise_id = ?
                ORDER BY p.date ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind IDs
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->exercise_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read all progress records for a user by muscle group
    public function readByUserAndMuscleGroup() {
        // Query to read all records with exercise details
        $query = "SELECT p.id, p.user_id, p.exercise_id, p.weight, p.date, 
                    p.created_at, p.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " p
                LEFT JOIN gym_exercises e ON p.exercise_id = e.id
                WHERE p.user_id = ? AND e.muscle_group = ?
                ORDER BY p.date ASC, e.name ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->muscle_group);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read latest progress for each exercise by user
    public function readLatestByUser() {
        // Query to read latest progress for each exercise
        $query = "SELECT p.id, p.user_id, p.exercise_id, p.weight, p.date, 
                    p.created_at, p.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " p
                INNER JOIN (
                    SELECT exercise_id, MAX(date) as max_date
                    FROM " . $this->table_name . "
                    WHERE user_id = ?
                    GROUP BY exercise_id
                ) latest ON p.exercise_id = latest.exercise_id AND p.date = latest.max_date
                LEFT JOIN gym_exercises e ON p.exercise_id = e.id
                WHERE p.user_id = ?
                ORDER BY e.muscle_group ASC, e.name ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind user ID twice (for both subquery and main query)
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->user_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one progress record
    public function readOne() {
        // Query to read single record with exercise details
        $query = "SELECT p.id, p.user_id, p.exercise_id, p.weight, p.date, 
                    p.created_at, p.updated_at, e.name as exercise_name, e.muscle_group
                FROM " . $this->table_name . " p
                LEFT JOIN gym_exercises e ON p.exercise_id = e.id
                WHERE p.id = ? AND p.user_id = ?
                LIMIT 0,1";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind IDs
        $stmt->bindParam(1, $this->id);
        $stmt->bindParam(2, $this->user_id);

        // Execute query
        $stmt->execute();

        // Get retrieved row
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            // Set values to object properties
            $this->id = $row['id'];
            $this->user_id = $row['user_id'];
            $this->exercise_id = $row['exercise_id'];
            $this->weight = $row['weight'];
            $this->date = $row['date'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            $this->exercise_name = $row['exercise_name'];
            $this->muscle_group = $row['muscle_group'];
            return true;
        }

        return false;
    }

    // Update progress record
    public function update() {
        // Sanitize inputs
        $this->weight = htmlspecialchars(strip_tags($this->weight));
        $this->date = htmlspecialchars(strip_tags($this->date));
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    weight = :weight,
                    date = :date
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":weight", $this->weight);
        $stmt->bindParam(":date", $this->date);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete progress record
    public function delete() {
        // Query to delete record
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ? AND user_id = ?";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize inputs
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Bind values
        $stmt->bindParam(1, $this->id);
        $stmt->bindParam(2, $this->user_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }
}