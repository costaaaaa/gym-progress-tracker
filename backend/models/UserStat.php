<?php
class UserStat {
    // Database connection and table name
    private $conn;
    private $table_name = "gym_user_stats";

    // Object properties
    public $id;
    public $user_id;
    public $date;
    public $weight;
    public $body_fat_percentage;
    public $muscle_mass_percentage;
    public $chest_size;
    public $arm_size;
    public $waist_size;
    public $leg_size;
    public $created_at;
    public $updated_at;

    // Constructor with database connection
    public function __construct($db) {
        $this->conn = $db;
    }

    // Create new record
    public function create() {
        // Sanitize inputs
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));
        $this->date = htmlspecialchars(strip_tags($this->date));
        $this->weight = !empty($this->weight) ? htmlspecialchars(strip_tags($this->weight)) : null;
        $this->body_fat_percentage = !empty($this->body_fat_percentage) ? htmlspecialchars(strip_tags($this->body_fat_percentage)) : null;
        $this->muscle_mass_percentage = !empty($this->muscle_mass_percentage) ? htmlspecialchars(strip_tags($this->muscle_mass_percentage)) : null;
        $this->chest_size = !empty($this->chest_size) ? htmlspecialchars(strip_tags($this->chest_size)) : null;
        $this->arm_size = !empty($this->arm_size) ? htmlspecialchars(strip_tags($this->arm_size)) : null;
        $this->waist_size = !empty($this->waist_size) ? htmlspecialchars(strip_tags($this->waist_size)) : null;
        $this->leg_size = !empty($this->leg_size) ? htmlspecialchars(strip_tags($this->leg_size)) : null;

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    user_id = :user_id,
                    date = :date,
                    weight = :weight,
                    body_fat_percentage = :body_fat_percentage,
                    muscle_mass_percentage = :muscle_mass_percentage,
                    chest_size = :chest_size,
                    arm_size = :arm_size,
                    waist_size = :waist_size,
                    leg_size = :leg_size";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":user_id", $this->user_id);
        $stmt->bindParam(":date", $this->date);
        $stmt->bindParam(":weight", $this->weight);
        $stmt->bindParam(":body_fat_percentage", $this->body_fat_percentage);
        $stmt->bindParam(":muscle_mass_percentage", $this->muscle_mass_percentage);
        $stmt->bindParam(":chest_size", $this->chest_size);
        $stmt->bindParam(":arm_size", $this->arm_size);
        $stmt->bindParam(":waist_size", $this->waist_size);
        $stmt->bindParam(":leg_size", $this->leg_size);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Read all records for a user
    public function readByUser() {
        // Query to read all records
        $query = "SELECT * FROM " . $this->table_name . "
                WHERE user_id = ?
                ORDER BY date ASC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind ID
        $stmt->bindParam(1, $this->user_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one record
    public function readOne() {
        $query = "SELECT * FROM " . $this->table_name . "
                WHERE id = ? AND user_id = ?
                LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->bindParam(2, $this->user_id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $this->id = $row['id'];
            $this->user_id = $row['user_id'];
            $this->date = $row['date'];
            $this->weight = $row['weight'];
            $this->body_fat_percentage = $row['body_fat_percentage'];
            $this->muscle_mass_percentage = $row['muscle_mass_percentage'];
            $this->chest_size = $row['chest_size'];
            $this->arm_size = $row['arm_size'];
            $this->waist_size = $row['waist_size'];
            $this->leg_size = $row['leg_size'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Read record by date and user
    public function readByDate() {
        $query = "SELECT * FROM " . $this->table_name . "
                WHERE user_id = ? AND date = ?
                LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->date);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $this->id = $row['id'];
            $this->weight = $row['weight'];
            $this->body_fat_percentage = $row['body_fat_percentage'];
            $this->muscle_mass_percentage = $row['muscle_mass_percentage'];
            $this->chest_size = $row['chest_size'];
            $this->arm_size = $row['arm_size'];
            $this->waist_size = $row['waist_size'];
            $this->leg_size = $row['leg_size'];
            return true;
        }

        return false;
    }

    // Update only weight
    public function updateWeight() {
        $query = "UPDATE " . $this->table_name . "
                SET weight = :weight
                WHERE id = :id AND user_id = :user_id";

        $stmt = $this->conn->prepare($query);

        $this->weight = htmlspecialchars(strip_tags($this->weight));
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        $stmt->bindParam(":weight", $this->weight);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Delete record
    public function delete() {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ? AND user_id = ?";
        $stmt = $this->conn->prepare($query);

        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        $stmt->bindParam(1, $this->id);
        $stmt->bindParam(2, $this->user_id);

        if ($stmt->execute()) {
            return true;
        }

        return false;
    }
}
