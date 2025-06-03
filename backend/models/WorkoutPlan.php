<?php
class WorkoutPlan
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_plans";

    // Object properties
    public $id;
    public $user_id;
    public $name;
    public $is_active;
    public $created_at;
    public $updated_at;
    public $days = [];

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Create new workout plan
    public function create()
    {
        // Sanitize inputs
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    user_id = :user_id,
                    name = :name,
                    is_active = :is_active";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":user_id", $this->user_id);
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":is_active", $this->is_active);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Read all workout plans for a user
    public function readAllByUser()
    {
        // Query to read all records
        $query = "SELECT id, name, is_active, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE user_id = ?
                ORDER BY created_at DESC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind user ID
        $stmt->bindParam(1, $this->user_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    public function readHistory()
    {
        // Query to fetch workout history
        $query = "SELECT id, date, exercises, notes 
                FROM gym_workout_history
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

    // Read one workout plan
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, user_id, name, is_active, created_at, updated_at
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
            $this->name = $row['name'];
            $this->is_active = $row['is_active'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Update workout plan
    public function update()
    {
        // Sanitize inputs
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->is_active = htmlspecialchars(strip_tags($this->is_active));
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    name = :name,
                    is_active = :is_active
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":is_active", $this->is_active);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete workout plan
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

    // Set active workout plan
    public function setActive()
    {
        // First, set all plans to inactive
        $query = "UPDATE " . $this->table_name . " SET is_active = 0 WHERE user_id = :user_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":user_id", $this->user_id);
        $stmt->execute();

        // Then set the selected plan to active
        $query = "UPDATE " . $this->table_name . " SET is_active = 1 WHERE id = :id AND user_id = :user_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Get active workout plan
    public function getActive()
    {
        // Query to read single record
        $query = "SELECT id, user_id, name, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE user_id = ? AND is_active = 1
                LIMIT 0,1";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind user ID
        $stmt->bindParam(1, $this->user_id);

        // Execute query
        $stmt->execute();

        // Get retrieved row
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            // Set values to object properties
            $this->id = $row['id'];
            $this->user_id = $row['user_id'];
            $this->name = $row['name'];
            $this->is_active = 1;
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Deactivate all workout plans for a user
    public function deactivateAllPlans()
    {
        $query = "UPDATE " . $this->table_name . " SET is_active = 0 WHERE user_id = :user_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":user_id", $this->user_id);
        return $stmt->execute();
    }

    // Activate a specific workout plan
    public function activate()
    {
        $query = "UPDATE " . $this->table_name . " SET is_active = 1 WHERE id = :id AND user_id = :user_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);
        return $stmt->execute();
    }
}
