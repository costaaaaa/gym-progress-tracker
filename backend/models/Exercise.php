<?php
class Exercise
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_exercises";

    // Object properties
    public $id;
    public $name;
    public $muscle_group;
    public $created_at;
    public $updated_at;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Read all exercises
    public function readAll()
    {
        // Query to read all records
        $query = "SELECT id, name, muscle_group, created_at, updated_at
                FROM " . $this->table_name . "
                ORDER BY name ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read exercises by muscle group
    public function readByMuscleGroup()
    {
        // Query to read records by muscle group
        $query = "SELECT id, name, muscle_group, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE muscle_group = ?
                ORDER BY name ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind muscle group
        $stmt->bindParam(1, $this->muscle_group);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one exercise
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, name, muscle_group, created_at, updated_at
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
            $this->name = $row['name'];
            $this->muscle_group = $row['muscle_group'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Create exercise
    public function create()
    {
        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                (name, muscle_group)
                VALUES (?, ?)";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Sanitize input
        $this->name = htmlspecialchars(strip_tags($this->name));
        $this->muscle_group = htmlspecialchars(strip_tags($this->muscle_group));

        // Bind values
        $stmt->bindParam(1, $this->name);
        $stmt->bindParam(2, $this->muscle_group);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }
}
