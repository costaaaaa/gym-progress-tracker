<?php
class WorkoutDay {
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_days";

    // Object properties
    public $id;
    public $plan_id;
    public $name;
    public $day_order;
    public $created_at;
    public $updated_at;
    public $exercises = [];

    // Constructor with database connection
    public function __construct($db) {
        $this->conn = $db;
    }

    // Create new workout day
    public function create() {
        // Sanitize inputs
        $this->plan_id = htmlspecialchars(strip_tags($this->plan_id));
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->day_order = htmlspecialchars(strip_tags($this->day_order));

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    plan_id = :plan_id,
                    name = :name,
                    day_order = :day_order";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":plan_id", $this->plan_id);
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":day_order", $this->day_order);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Read all workout days for a plan
    public function readAllByPlan() {
        // Query to read all records
        $query = "SELECT id, name, day_order, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE plan_id = ?
                ORDER BY day_order ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind plan ID
        $stmt->bindParam(1, $this->plan_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one workout day
    public function readOne() {
        // Query to read single record
        $query = "SELECT id, plan_id, name, day_order, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE id = ?
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
            $this->plan_id = $row['plan_id'];
            $this->name = $row['name'];
            $this->day_order = $row['day_order'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Update workout day
    public function update() {
        // Sanitize inputs
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->day_order = htmlspecialchars(strip_tags($this->day_order));
        $this->id = htmlspecialchars(strip_tags($this->id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    name = :name,
                    day_order = :day_order
                WHERE id = :id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":day_order", $this->day_order);
        $stmt->bindParam(":id", $this->id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete workout day
    public function delete() {
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
}