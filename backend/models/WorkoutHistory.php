<?php
class WorkoutHistory
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_workout_history";

    // Object properties
    public $id;
    public $user_id;
    public $date;
    public $time_zone = null;
    public $duration_seconds = null;
    public $notes;
    public $idempotency_key = null;
    public $day_id = null; // giorno di scheda dell'allenamento (null = non noto), senza chiave esterna

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
            // Niente htmlspecialchars: l'escape lo fa chi mostra il testo (vedi Exercise::create)
            $this->notes = trim((string)$this->notes);

            // La colonna idempotency_key entra nella query solo se c'è la chiave: le app vecchie
            // salvano anche se l'immagine nuova arriva prima della migrazione 20.
            $key_clause = $this->idempotency_key === null ? "" : ",
                        idempotency_key = :idempotency_key";

            // Come la chiave: day_id entra nella query solo se c'è
            if ($this->day_id !== null) {
                $key_clause .= ",
                        day_id = :day_id";
            }

            // Query to insert record
            $query = "INSERT INTO " . $this->table_name . "
                    SET
                        user_id = :user_id,
                        date = :date,
                        duration_seconds = :duration_seconds,
                        notes = :notes,
                        time_zone = :time_zone" . $key_clause;

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Bind values
            $stmt->bindParam(":user_id", $this->user_id);
            $stmt->bindParam(":date", $this->date);
            $stmt->bindParam(":time_zone", $this->time_zone);
            $stmt->bindValue(":duration_seconds", $this->duration_seconds, $this->duration_seconds === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindParam(":notes", $this->notes);
            if ($this->idempotency_key !== null) {
                $stmt->bindValue(":idempotency_key", $this->idempotency_key, PDO::PARAM_STR);
            }
            if ($this->day_id !== null) {
                $stmt->bindValue(":day_id", $this->day_id, PDO::PARAM_INT);
            }

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

    // Id dell'allenamento dell'utente già salvato con questa chiave, altrimenti null
    public static function findIdByIdempotencyKey($db, $user_id, $key)
    {
        $stmt = $db->prepare("SELECT id FROM gym_workout_history WHERE user_id = ? AND idempotency_key = ?");
        $stmt->execute([$user_id, $key]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : $id;
    }

    // Read all workout history records for a user
    public function readAllByUser()
    {
        // Query to read all records
        // day_name: il nome del giorno di scheda; NULL se l'allenamento non ha un giorno o se il giorno è stato eliminato.
        // Il giorno si cerca solo fra quelli delle schede dell'utente.
        $query = "SELECT wh.id, wh.date, wh.time_zone, wh.duration_seconds, wh.notes, wh.health_written_at, wd.id AS day_id, wd.name AS day_name
                FROM " . $this->table_name . " wh
                LEFT JOIN (SELECT d.id, d.name FROM gym_workout_days d JOIN gym_workout_plans p ON p.id = d.plan_id WHERE p.user_id = ?) wd
                       ON wd.id = wh.day_id
                WHERE wh.user_id = ?
                ORDER BY wh.date DESC";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind user ID
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->user_id);

        // Execute query
        $stmt->execute();

        return $stmt;
    }

    // Read one workout history record
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, user_id, date, notes
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
        $this->notes = trim((string)$this->notes);

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    date = :date,
                    notes = :notes
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
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