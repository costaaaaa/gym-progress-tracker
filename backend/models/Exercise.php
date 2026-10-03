<?php
class Exercise
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_exercises";

    // Esercizi personali non ancora approvati che un utente può avere
    const MAX_PERSONAL = 30;
    const STATUSES = array('pending', 'approved', 'rejected');

    // Object properties
    public $id;
    public $name;
    public $muscle_group;
    public $created_by;
    public $status;
    public $created_at;
    public $updated_at;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
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

    // Catalogo visibile a un utente: gli approvati più i suoi personali (in attesa o rifiutati).
    // Senza utente (null) solo gli approvati.
    public function readVisibleTo($user_id)
    {
        $query = "SELECT id, name, muscle_group, status, created_by, created_at, updated_at
                FROM " . $this->table_name . "
                WHERE status = 'approved' OR created_by = ?
                ORDER BY name ASC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$user_id === null ? 0 : (int)$user_id]);
        return $stmt;
    }

    // True se l'utente può usare l'esercizio (approvato o creato da lui)
    public static function isVisibleTo($db, $exercise_id, $user_id)
    {
        $stmt = $db->prepare("SELECT 1 FROM gym_exercises WHERE id = ? AND (status = 'approved' OR created_by = ?) LIMIT 1");
        $stmt->execute([(int)$exercise_id, (int)$user_id]);
        return $stmt->fetchColumn() !== false;
    }

    // Nome pulito (spazi compressi) o null se non valido: 2-60 caratteri tra lettere, cifre,
    // spazi e un po' di punteggiatura; niente link né indirizzi. Il nome finisce nel catalogo
    // di tutti e nel contesto dell'AI Coach, per questo è più stretto del nome di un gruppo.
    public static function cleanName($name)
    {
        if (!is_string($name)) return null;
        $name = trim(preg_replace('/\s+/u', ' ', $name));
        $length = mb_strlen($name, 'UTF-8');
        if ($length < 2 || $length > 60) return null;
        if (!preg_match("~^[\p{L}\p{N} '’()/.,+&-]+$~u", $name)) return null;
        if (preg_match('~(https?://|www\.|\b[a-z0-9-]+\.(com|it|net|org|app|io|me|ly|gg)\b)~i', $name)) return null;
        return $name;
    }

    // Gruppi muscolari ammessi: quelli del catalogo approvato (minuscoli, come nel seed)
    public function muscleGroups()
    {
        $stmt = $this->conn->query("SELECT DISTINCT muscle_group FROM " . $this->table_name . " WHERE status = 'approved' ORDER BY muscle_group");
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // Esercizio visibile all'utente con lo stesso nome (senza distinguere maiuscole), o null
    public function findVisibleByName($name, $user_id)
    {
        $stmt = $this->conn->prepare("SELECT id, name, muscle_group, status, created_by FROM " . $this->table_name . "
                WHERE LOWER(name) = LOWER(?) AND (status = 'approved' OR created_by = ?)
                ORDER BY status = 'approved' DESC LIMIT 1");
        $stmt->execute([$name, (int)$user_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // Esercizi personali non approvati dell'utente (per il tetto MAX_PERSONAL)
    public function countPersonal($user_id)
    {
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM " . $this->table_name . " WHERE created_by = ? AND status <> 'approved'");
        $stmt->execute([(int)$user_id]);
        return (int)$stmt->fetchColumn();
    }

    // Crea l'esercizio con name, muscle_group, created_by e status già validati.
    // Niente htmlspecialchars: il nome è già passato da cleanName() e l'escape lo fa chi lo mostra
    // (con PHP 8.1+ "dell'atleta" diventerebbe "dell&#039;atleta").
    public function create()
    {
        $query = "INSERT INTO " . $this->table_name . "
                (name, muscle_group, created_by, status)
                VALUES (?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);

        if ($stmt->execute([$this->name, $this->muscle_group, $this->created_by, $this->status])) {
            $this->id = (int)$this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    // Esercizi con un certo stato, con il creatore e quante volte sono usati (schede, set, progressi)
    public function adminList($status)
    {
        $stmt = $this->conn->prepare("SELECT e.id, e.name, e.muscle_group, e.status, e.created_at, e.reviewed_at,
                       u.username AS created_by_username,
                       (SELECT COUNT(*) FROM gym_workout_exercises we WHERE we.exercise_id = e.id)
                     + (SELECT COUNT(*) FROM gym_workout_sets ws WHERE ws.exercise_id = e.id)
                     + (SELECT COUNT(*) FROM gym_progress p WHERE p.exercise_id = e.id) AS uses
                FROM " . $this->table_name . " e
                LEFT JOIN gym_users u ON u.id = e.created_by
                WHERE e.status = ?
                ORDER BY " . ($status === 'approved' ? "e.name ASC" : "e.created_at ASC, e.id ASC"));
        $stmt->execute([$status]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['uses'] = (int)$r['uses'];
        }
        return $rows;
    }

    // Riga dell'esercizio (con status) o null
    public function find($id)
    {
        $stmt = $this->conn->prepare("SELECT id, name, muscle_group, status, created_by FROM " . $this->table_name . " WHERE id = ? LIMIT 1");
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // True se un esercizio approvato diverso da $except_id ha già questo nome
    public function approvedNameTaken($name, $except_id = 0)
    {
        $stmt = $this->conn->prepare("SELECT 1 FROM " . $this->table_name . " WHERE LOWER(name) = LOWER(?) AND status = 'approved' AND id <> ? LIMIT 1");
        $stmt->execute([$name, (int)$except_id]);
        return $stmt->fetchColumn() !== false;
    }

    public function setStatus($id, $status)
    {
        $stmt = $this->conn->prepare("UPDATE " . $this->table_name . " SET status = ?, reviewed_at = NOW() WHERE id = ?");
        $stmt->execute([$status, (int)$id]);
    }

    public function updateDetails($id, $name, $muscle_group)
    {
        $stmt = $this->conn->prepare("UPDATE " . $this->table_name . " SET name = ?, muscle_group = ? WHERE id = ?");
        $stmt->execute([$name, $muscle_group, (int)$id]);
    }

    // Quante volte è usato in schede, set e progressi (qualsiasi utente)
    public function usageCount($id)
    {
        $stmt = $this->conn->prepare("SELECT
                (SELECT COUNT(*) FROM gym_workout_exercises WHERE exercise_id = ?)
              + (SELECT COUNT(*) FROM gym_workout_sets WHERE exercise_id = ?)
              + (SELECT COUNT(*) FROM gym_progress WHERE exercise_id = ?)");
        $stmt->execute([(int)$id, (int)$id, (int)$id]);
        return (int)$stmt->fetchColumn();
    }

    public function delete($id)
    {
        $stmt = $this->conn->prepare("DELETE FROM " . $this->table_name . " WHERE id = ?");
        $stmt->execute([(int)$id]);
    }
}
