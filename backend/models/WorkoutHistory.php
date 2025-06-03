<?php
class WorkoutHistory
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_history";

    // Object properties
    public $id;
    public $user_id;
    public $exercises;
    public $date;
    public $notes;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Create a new workout history record
    public function create()
    {
        try {
            // Sanitize inputs
            $this->user_id = htmlspecialchars(strip_tags($this->user_id));
            $this->notes = htmlspecialchars(strip_tags($this->notes));
            // Non sanifichiamo $this->exercises perché è un JSON che deve essere preservato

            // Query to insert record
            $query = "INSERT INTO " . $this->table_name . "
                    SET
                        user_id = :user_id,
                        exercises = :exercises,
                        date = :date,
                        notes = :notes";

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Bind values
            $stmt->bindParam(":user_id", $this->user_id);
            $stmt->bindParam(":exercises", $this->exercises);
            $stmt->bindParam(":date", $this->date);
            $stmt->bindParam(":notes", $this->notes);

            // Execute query
            if ($stmt->execute()) {
                $this->id = $this->conn->lastInsertId();
                return true;
            }

            return false;
        } catch (PDOException $e) {
            error_log("Database error during workout history creation: " . $e->getMessage());
            throw $e;
        }
    }

    // Read all workout history records for a user
    public function readAllByUser()
    {
        // Query to read all records
        $query = "SELECT id, exercises, date, notes
                FROM " . $this->table_name . "
                WHERE user_id = ?
                ORDER BY date DESC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind user ID
        $stmt->bindParam(1, $this->user_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one workout history record
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, user_id, exercises, date, notes
                FROM " . $this->table_name . "
                WHERE id = ? AND user_id = ?
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
            $this->exercises = $row['exercises'];
            $this->date = $row['date'];
            $this->notes = $row['notes'];
            return true;
        }

        return false;
    }

    // Update workout history record
    public function update()
    {
        // Sanitize inputs
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));
        $this->notes = htmlspecialchars(strip_tags($this->notes));
        // Non sanifichiamo $this->exercises perché è un JSON che deve essere preservato

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    exercises = :exercises,
                    date = :date,
                    notes = :notes
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":exercises", $this->exercises);
        $stmt->bindParam(":date", $this->date);
        $stmt->bindParam(":notes", $this->notes);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete workout history record
    public function delete()
    {
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