<?php
class WorkoutPlan
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_plans";

    // Schede che un utente può avere (argine all'abuso, non una regola di prodotto: sotto richieste
    // contemporanee il tetto può essere superato di poco, senza transazioni né lock)
    const MAX_PER_USER = 50;

    // Object properties
    public $id;
    public $user_id;
    public $name;
    public $description;
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
        $this->name = trim($this->name);
        $this->description = trim($this->description);
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to insert record
        $query = "INSERT INTO " . $this->table_name . "
                SET
                    user_id = :user_id,
                    name = :name,
                    description = :description,
                    is_active = :is_active";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":user_id", $this->user_id);
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":description", $this->description);
        $stmt->bindParam(":is_active", $this->is_active);

        // Execute query
        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Crea la scheda mantenendo una sola scheda attiva per utente. $requested_active è la richiesta
    // del client: true = attiva (le altre vengono disattivate), false = non attiva, null = non
    // richiesto: nasce attiva solo se l'utente non ne ha nessuna attiva. La riga dell'utente è
    // bloccata per la durata della transazione, così due creazioni contemporanee non risultano
    // entrambe attive.
    public function createKeepingOneActive($requested_active)
    {
        try {
            $this->conn->beginTransaction();
            $lock = $this->conn->prepare("SELECT id FROM gym_users WHERE id = ? FOR UPDATE");
            $lock->execute([(int)$this->user_id]);

            if ($requested_active === null) {
                $stmt = $this->conn->prepare("SELECT COUNT(*) FROM " . $this->table_name . " WHERE user_id = ? AND is_active = 1");
                $stmt->execute([(int)$this->user_id]);
                $this->is_active = (int)$stmt->fetchColumn() === 0 ? 1 : 0;
            } else {
                $this->is_active = $requested_active ? 1 : 0;
                if ($this->is_active === 1) {
                    $this->deactivateAllPlans();
                }
            }

            if (!$this->create()) {
                $this->conn->rollBack();
                return false;
            }
            return $this->conn->commit();
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log("Create plan error: " . $e->getMessage());
            return false;
        }
    }

    // Numero di schede dell'utente (per il tetto MAX_PER_USER)
    public function countByUser($user_id)
    {
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM " . $this->table_name . " WHERE user_id = ?");
        $stmt->execute([(int)$user_id]);
        return (int)$stmt->fetchColumn();
    }

    // Read all workout plans for a user
    public function readAllByUser()
    {
        // Query to read all records
        $query = "SELECT id, name, description, is_active, created_at, updated_at
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

    // Read one workout plan
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, user_id, name, description, is_active, created_at, updated_at
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
            $this->description = $row['description'];
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
        $this->name = trim($this->name);
        $this->description = trim($this->description);
        $this->is_active = htmlspecialchars(strip_tags($this->is_active));
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    name = :name,
                    description = :description,
                    is_active = :is_active
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":description", $this->description);
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

    // Get active workout plan
    public function getActive()
    {
        // Query to read single record
        $query = "SELECT id, user_id, name, description, created_at, updated_at
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
            $this->description = $row['description'];
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

    // Rende attiva solo questa scheda: i due UPDATE stanno in una transazione, così un guasto
    // fra l'uno e l'altro non lascia l'utente senza scheda attiva.
    public function activateExclusively()
    {
        try {
            $this->conn->beginTransaction();
            $this->deactivateAllPlans();
            $this->activate();
            return $this->conn->commit();
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log("Activate plan error: " . $e->getMessage());
            return false;
        }
    }
}
