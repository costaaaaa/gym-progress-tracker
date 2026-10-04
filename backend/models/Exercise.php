<?php
class Exercise
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_exercises";

    // Esercizi personali non ancora approvati che un utente può avere
    const MAX_PERSONAL = 30;
    const STATUSES = array('pending', 'approved', 'rejected');
    // Sopra questa somiglianza (0-1) due nomi sono proposti come possibile doppione
    const SIMILAR_MIN = 0.6;
    // Parole che non distinguono un esercizio da un altro
    const STOPWORDS = array('a', 'ad', 'ai', 'al', 'all', 'alla', 'alle', 'agli', 'allo', 'con', 'col', 'coi',
        'da', 'dal', 'dalla', 'dai', 'di', 'del', 'dell', 'della', 'delle', 'dei', 'degli', 'dello', 'e', 'ed',
        'il', 'la', 'le', 'lo', 'i', 'gli', 'l', 'in', 'nel', 'nell', 'nella', 'su', 'sul', 'sull', 'sulla',
        'per', 'the', 'of', 'with');

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
        $query = "SELECT id, name, name_en, muscle_group, equipment, status, created_by, created_at, updated_at
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
        $stmt = $this->conn->prepare("SELECT id, name, name_en, muscle_group, equipment, status, created_by FROM " . $this->table_name . "
                WHERE (LOWER(name) = LOWER(?) OR LOWER(name_en) = LOWER(?)) AND (status = 'approved' OR created_by = ?)
                ORDER BY status = 'approved' DESC LIMIT 1");
        $stmt->execute([$name, $name, (int)$user_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // ── Nomi simili (possibili doppioni) ─────────────────────────────────────

    // Parole del nome senza maiuscole, accenti, punteggiatura e articoli/preposizioni
    public static function nameTokens($name)
    {
        $s = mb_strtolower((string)$name, 'UTF-8');
        $s = strtr($s, array('à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'è' => 'e', 'é' => 'e', 'ê' => 'e',
            'ë' => 'e', 'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o',
            'ö' => 'o', 'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ñ' => 'n', 'ç' => 'c'));
        $words = preg_split('~[^a-z0-9]+~', $s, -1, PREG_SPLIT_NO_EMPTY);
        return array_values(array_diff($words, self::STOPWORDS));
    }

    // Stessa parola a meno di una lettera: refuso o desinenza (cavo/cavi, manubrio/manubri). Non di
    // più, altrimenti inclinata/declinata risulterebbero la stessa parola.
    private static function tokensMatch($a, $b)
    {
        if ($a === $b || rtrim($a, 's') === rtrim($b, 's')) return true; // plurali inglesi: dip/dips
        if (min(strlen($a), strlen($b)) < 4) return false;
        return levenshtein($a, $b) <= 1;
    }

    // Somiglianza tra due nomi, da 0 a 1: la migliore tra parole in comune (coefficiente di Dice,
    // "Panca piana" ~ "Panca piana bilanciere") e distanza tra i nomi senza spazi, che conta solo se
    // sono quasi uguali ("Pulldown" ~ "Pull down"): più in basso premierebbe ogni nome che ha in
    // comune una parola lunga ("Curl con manubri" ~ "Calf con manubrio").
    public static function nameSimilarity($a, $b)
    {
        $ta = self::nameTokens($a);
        $tb = self::nameTokens($b);
        if (!$ta || !$tb) return 0.0;

        $matched = 0;
        $used = array();
        foreach ($ta as $x) {
            foreach ($tb as $j => $y) {
                if (!isset($used[$j]) && self::tokensMatch($x, $y)) {
                    $used[$j] = true;
                    $matched++;
                    break;
                }
            }
        }
        $dice = 2 * $matched / (count($ta) + count($tb));

        $sa = implode('', $ta);
        $sb = implode('', $tb);
        $edit = 1 - levenshtein($sa, $sb) / max(strlen($sa), strlen($sb));

        return max($dice, $edit >= 0.85 ? $edit : 0.0);
    }

    // I $limit esercizi di $candidates (righe con id e name) più simili a $name, dal più simile
    public static function mostSimilar($name, array $candidates, $limit = 3, $except_id = 0)
    {
        $found = array();
        foreach ($candidates as $c) {
            if ((int)$c['id'] === (int)$except_id) continue;
            $score = self::nameSimilarity($name, $c['name']);
            if (!empty($c['name_en'])) $score = max($score, self::nameSimilarity($name, $c['name_en']));
            if ($score >= self::SIMILAR_MIN) {
                $c['score'] = round($score, 2);
                $found[] = $c;
            }
        }
        usort($found, function ($x, $y) {
            return $y['score'] <=> $x['score'] ?: strcmp($x['name'], $y['name']);
        });
        return array_slice($found, 0, $limit);
    }

    // Esercizi visibili all'utente (approvati + suoi; solo approvati se $user_id è null)
    public function visibleRows($user_id)
    {
        $stmt = $this->conn->prepare("SELECT id, name, name_en, muscle_group, equipment, status, created_by FROM " . $this->table_name . "
                WHERE status = 'approved' OR created_by = ?");
        $stmt->execute([$user_id === null ? 0 : (int)$user_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
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
        // Per gli esercizi da rivedere, quelli del catalogo con un nome simile: possibili doppioni
        $catalog = $status === 'approved' ? array() : $this->visibleRows(null);
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['uses'] = (int)$r['uses'];
            $r['similar'] = array_map(function ($c) {
                return array('id' => (int)$c['id'], 'name' => $c['name'], 'muscle_group' => $c['muscle_group']);
            }, self::mostSimilar($r['name'], $catalog, 3, $r['id']));
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
        $stmt = $this->conn->prepare("SELECT 1 FROM " . $this->table_name . " WHERE (LOWER(name) = LOWER(?) OR LOWER(name_en) = LOWER(?)) AND status = 'approved' AND id <> ? LIMIT 1");
        $stmt->execute([$name, $name, (int)$except_id]);
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
