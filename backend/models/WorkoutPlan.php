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
    public $description;
    public $is_active;
    public $created_at;
    public $updated_at;
    public $days = [];
    // Impostato da lockOwnPlan() se la scheda non esiste più (il chiamante risponde 404)
    public $plan_gone = false;

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

    // Esegue $work in una transazione che tiene bloccata la riga dell'utente: creazioni e attivazioni
    // dello stesso utente si mettono in fila, così non risultano mai due schede attive. $work ritorna
    // true per confermare, false per annullare.
    // Non annidabile: se il chiamante ha già una transazione aperta lancia LogicException senza toccarla.
    private function runLockedForUser($label, callable $work)
    {
        if ($this->conn->inTransaction()) {
            throw new LogicException($label . ": transazione già aperta");
        }
        $this->plan_gone = false;
        try {
            $this->conn->beginTransaction();
            if (!$this->lockUser() || !$work()) {
                $this->conn->rollBack();
                return false;
            }
            return $this->conn->commit();
        } catch (PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log($label . " error: " . $e->getMessage());
            return false;
        }
    }

    // Blocca la riga della scheda dell'utente (SELECT ... FOR UPDATE, quindi vale anche se un UPDATE
    // successivo non cambierebbe nulla, a differenza di rowCount()). Se la scheda è stata cancellata
    // dopo il controllo del chiamante imposta $plan_gone e ritorna false: il chiamante risponde 404.
    private function lockOwnPlan()
    {
        $stmt = $this->conn->prepare("SELECT id FROM " . $this->table_name . " WHERE id = ? AND user_id = ? FOR UPDATE");
        $stmt->execute([(int)$this->id, (int)$this->user_id]);
        if ($stmt->fetchColumn() === false) {
            $this->plan_gone = true;
            return false;
        }
        return true;
    }

    // Blocca la riga dell'utente fino alla fine della transazione. Ritorna false se non esiste più
    // (stesso schema di PasswordReset::lockUser()).
    private function lockUser()
    {
        $stmt = $this->conn->prepare("SELECT id FROM gym_users WHERE id = ? FOR UPDATE");
        $stmt->execute([(int)$this->user_id]);
        return $stmt->fetchColumn() !== false;
    }

    // Crea la scheda facendo in modo che l'utente abbia al massimo una scheda attiva.
    // $requested_active è la richiesta del client: true = attiva (le altre vengono disattivate),
    // false = non attiva, null = non richiesto: nasce attiva solo se l'utente non ne ha nessuna attiva.
    public function createAtMostOneActive($requested_active)
    {
        return $this->runLockedForUser("Create plan", function () use ($requested_active) {
            if ($requested_active === null) {
                // Il lock dell'utente (runLockedForUser) non apre lo snapshot: il COUNT lo apre dopo averlo ottenuto
                // (REPEATABLE READ) e quindi vede le creazioni e attivazioni già confermate.
                $stmt = $this->conn->prepare("SELECT COUNT(*) FROM " . $this->table_name . " WHERE user_id = ? AND is_active = 1");
                $stmt->execute([(int)$this->user_id]);
                $this->is_active = (int)$stmt->fetchColumn() === 0 ? 1 : 0;
            } else {
                $this->is_active = $requested_active ? 1 : 0;
                if ($this->is_active === 1) {
                    $this->deactivateAllPlans();
                }
            }
            return $this->create();
        });
    }

    // Numero di schede dell'utente (per il tetto del livello, lib/tier_limits.php)
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

    // Modifica solo nome e descrizione: is_active non si tocca
    public function update()
    {
        // Sanitize inputs
        $this->name = trim($this->name);
        $this->description = trim($this->description);
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Query to update record
        $query = "UPDATE " . $this->table_name . "
                SET
                    name = :name,
                    description = :description
                WHERE id = :id AND user_id = :user_id";

        // Prepare query
        $stmt = $this->conn->prepare($query);

        // Bind values
        $stmt->bindParam(":name", $this->name);
        $stmt->bindParam(":description", $this->description);
        $stmt->bindParam(":id", $this->id);
        $stmt->bindParam(":user_id", $this->user_id);

        // Execute query
        if ($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Cancella giorni ed esercizi delle schede di un utente (tutte, o solo $plan_id), senza aprire
    // transazioni: le apre il chiamante. Serve perché con MySQL 9.7 la cascata a quattro livelli
    // (schede > giorni > esercizi > serie pianificate) si ferma a metà e lascia righe orfane; le
    // serie pianificate seguono gli esercizi con la cascata a un livello.
    public function deleteDaysAndExercises($user_id, $plan_id = null)
    {
        if (!$this->conn->inTransaction()) {
            throw new LogicException("deleteDaysAndExercises() va chiamato dentro una transazione aperta dal chiamante");
        }

        $where = "WHERE p.user_id = ?" . ($plan_id === null ? "" : " AND p.id = ?");
        $params = $plan_id === null ? [$user_id] : [$user_id, $plan_id];

        $stmt = $this->conn->prepare("DELETE e FROM gym_workout_exercises e
            JOIN gym_workout_days d ON d.id = e.day_id
            JOIN " . $this->table_name . " p ON p.id = d.plan_id
            $where");
        $stmt->execute($params);

        $stmt = $this->conn->prepare("DELETE d FROM gym_workout_days d
            JOIN " . $this->table_name . " p ON p.id = d.plan_id
            $where");
        $stmt->execute($params);
    }

    // Delete workout plan
    public function delete()
    {
        // Query to delete record
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ? AND user_id = ?";

        // Sanitize inputs
        $this->id = htmlspecialchars(strip_tags($this->id));
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));

        // Giorni ed esercizi si cancellano a mano (vedi deleteDaysAndExercises), nella stessa transazione della scheda
        $this->conn->beginTransaction();
        try {
            $this->deleteDaysAndExercises($this->user_id, $this->id);

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Bind values
            $stmt->bindParam(1, $this->id);
            $stmt->bindParam(2, $this->user_id);

            // Execute query
            if ($stmt->execute()) {
                $this->conn->commit();
                return true;
            }

            $this->conn->rollBack();
            return false;
        } catch (Exception $e) {
            // Su errore si annulla tutto e si rilancia l'eccezione: com'era prima della transazione
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
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

    // Rende attiva solo questa scheda: disattivazione e attivazione stanno in una transazione, così
    // un guasto fra le due non lascia l'utente senza scheda attiva.
    public function activateExclusively()
    {
        return $this->runLockedForUser("Activate plan", function () {
            if (!$this->lockOwnPlan()) {
                return false;
            }
            $this->deactivateAllPlans();
            return $this->activate();
        });
    }
}
