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
        // Niente htmlspecialchars: l'escape lo fa chi mostra il testo (vedi Exercise::create)
        $this->name = trim((string)$this->name);
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

    // Numero di giorni della scheda (per il tetto del livello, lib/tier_limits.php)
    public function countByPlan($plan_id) {
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM " . $this->table_name . " WHERE plan_id = ?");
        $stmt->execute([(int)$plan_id]);
        return (int)$stmt->fetchColumn();
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
        $this->name = trim((string)$this->name);
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

    // Elimina il giorno ($this->id) con i suoi esercizi e le serie pianificate, e rinumera i giorni
    // rimasti (day_order 1..n, ordine conservato). In una transazione, con cancellazioni esplicite dal
    // basso (serie pianificate, esercizi, giorno): su MySQL 9.7 le cascate lunghe possono lasciare righe
    // orfane (WorkoutPlan::deleteDaysAndExercises fa lo stesso per esercizi e giorni di una scheda).
    // I giorni della scheda sono bloccati (FOR UPDATE): controllo dell'ultimo giorno e rinumerazione non
    // si accavallano con un'altra eliminazione. Ritorna 'deleted', 'last_day' (l'ultimo giorno di una scheda
    // non si elimina) o 'not_found' (già eliminato); su errore annulla tutto e rilancia l'eccezione.
    public function delete() {
        $id = (int)$this->id;
        $this->conn->beginTransaction();
        try {
            $stmt = $this->conn->prepare("SELECT plan_id FROM " . $this->table_name . " WHERE id = ? FOR UPDATE");
            $stmt->execute([$id]);
            $plan_id = $stmt->fetchColumn();
            if ($plan_id === false) {
                $this->conn->rollBack();
                return 'not_found';
            }

            $stmt = $this->conn->prepare("SELECT id FROM " . $this->table_name . " WHERE plan_id = ? ORDER BY day_order, id FOR UPDATE");
            $stmt->execute([(int)$plan_id]);
            $day_ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
            if (count($day_ids) <= 1) {
                $this->conn->rollBack();
                return 'last_day';
            }

            $this->conn->prepare("DELETE ps FROM gym_workout_plan_sets ps
                                  JOIN gym_workout_exercises e ON e.id = ps.workout_exercise_id
                                  WHERE e.day_id = ?")->execute([$id]);
            $this->conn->prepare("DELETE FROM gym_workout_exercises WHERE day_id = ?")->execute([$id]);
            $this->conn->prepare("DELETE FROM " . $this->table_name . " WHERE id = ?")->execute([$id]);

            $update = $this->conn->prepare("UPDATE " . $this->table_name . " SET day_order = ? WHERE id = ?");
            $order = 0;
            foreach ($day_ids as $day_id) {
                if ($day_id !== $id) {
                    $update->execute([++$order, $day_id]);
                }
            }

            $this->conn->commit();
            return 'deleted';
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
    }
}