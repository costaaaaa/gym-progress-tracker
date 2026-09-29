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
    public $health_fields;
    public $created_at;
    public $updated_at;

    // Constructor with database connection
    public function __construct($db) {
        $this->conn = $db;
    }

    // Campi che possono arrivare da Apple Salute / Health Connect (colonna SET health_fields)
    const HEALTH_FIELDS = array('weight', 'body_fat_percentage', 'waist_size');
    const ALL_FIELDS = array(
        'weight', 'body_fat_percentage', 'muscle_mass_percentage',
        'chest_size', 'arm_size', 'waist_size', 'leg_size',
    );

    // true se create() ha inserito una riga nuova, false se ha completato quella del giorno
    public $created = false;

    // Salva le misure inserite a mano. Una riga per giorno: se esiste già, i campi indicati la
    // aggiornano e gli altri restano com'erano. Un campo scritto a mano non è più "da Salute".
    public function create() {
        $values = array();
        foreach (self::ALL_FIELDS as $field) {
            $values[$field] = self::toNumber($this->$field);
        }

        // Bit dei campi da togliere da health_fields: nel SET weight=1, body_fat=2, waist=4
        $mask = 0;
        foreach (self::HEALTH_FIELDS as $bit => $field) {
            if ($values[$field] !== null) {
                $mask |= 1 << $bit;
            }
        }

        $columns = implode(', ', self::ALL_FIELDS);
        $placeholders = ':' . implode(', :', self::ALL_FIELDS);
        $updates = array();
        foreach (self::ALL_FIELDS as $field) {
            $updates[] = "$field = COALESCE(VALUES($field), $field)";
        }
        $query = "INSERT INTO " . $this->table_name . " (user_id, date, $columns)
                VALUES (:user_id, :date, $placeholders)
                ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    " . implode(",\n                    ", $updates) . ",
                    health_fields = health_fields & ~$mask";

        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(':user_id', (int) $this->user_id, PDO::PARAM_INT);
        $stmt->bindValue(':date', $this->date);
        foreach ($values as $field => $value) {
            $stmt->bindValue(":$field", $value === null ? null : (string) $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        }

        if ($stmt->execute()) {
            // rowCount: 1 = riga nuova, 2 = riga aggiornata, 0 = niente da cambiare
            $this->created = $stmt->rowCount() === 1;
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

    // Applica i valori di un giorno letti da Salute. $values contiene solo i campi da cambiare:
    // un numero è il valore del giorno, null vuol dire che in Salute non c'è più.
    // Regole: un valore inserito a mano vince sempre; null svuota solo i campi arrivati da Salute;
    // una riga rimasta senza valori si cancella. Va chiamato dentro una transazione.
    // Restituisce 'created', 'updated', 'cleared' (riga cancellata) o 'skipped'.
    public function upsertFromHealth($userId, $date, array $values) {
        $stmt = $this->conn->prepare("SELECT * FROM " . $this->table_name . "
                WHERE user_id = ? AND date = ? FOR UPDATE");
        $stmt->execute(array((int) $userId, $date));
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $fields = array();
            foreach (self::HEALTH_FIELDS as $field) {
                if (array_key_exists($field, $values) && $values[$field] !== null) {
                    $fields[$field] = $values[$field];
                }
            }
            if (!$fields) {
                return 'skipped';
            }
            $names = array_keys($fields);
            $stmt = $this->conn->prepare("INSERT INTO " . $this->table_name . "
                    (user_id, date, " . implode(', ', $names) . ", health_fields)
                    VALUES (?, ?" . str_repeat(', ?', count($names)) . ", ?)");
            $stmt->execute(array_merge(
                array((int) $userId, $date),
                array_map('strval', array_values($fields)),
                array(implode(',', $names))
            ));
            return 'created';
        }

        $fromHealth = $row['health_fields'] === '' ? array() : explode(',', $row['health_fields']);
        $changes = array();
        foreach (self::HEALTH_FIELDS as $field) {
            if (!array_key_exists($field, $values)) {
                continue;
            }
            $imported = in_array($field, $fromHealth, true);
            if ($row[$field] !== null && !$imported) {
                continue; // inserito a mano: vince
            }
            $value = $values[$field];
            if ($value === null) {
                if ($imported) {
                    $changes[$field] = null;
                    $fromHealth = array_values(array_diff($fromHealth, array($field)));
                }
            } elseif ($row[$field] === null || (float) $row[$field] !== (float) $value) {
                $changes[$field] = $value;
                if (!$imported) {
                    $fromHealth[] = $field;
                }
            }
        }
        if (!$changes) {
            return 'skipped';
        }

        $remaining = array_filter(self::ALL_FIELDS, function ($field) use ($row, $changes) {
            $value = array_key_exists($field, $changes) ? $changes[$field] : $row[$field];
            return $value !== null;
        });
        if (!$remaining) {
            $this->conn->prepare("DELETE FROM " . $this->table_name . " WHERE id = ?")
                ->execute(array($row['id']));
            return 'cleared';
        }

        $sets = array();
        $params = array();
        foreach ($changes as $field => $value) {
            $sets[] = "$field = ?";
            $params[] = $value === null ? null : (string) $value;
        }
        $sets[] = "health_fields = ?";
        $params[] = implode(',', $fromHealth);
        $params[] = $row['id'];
        $this->conn->prepare("UPDATE " . $this->table_name . " SET " . implode(', ', $sets) . " WHERE id = ?")
            ->execute($params);
        return 'updated';
    }

    // Scollega Salute: svuota i campi importati (quelli scritti a mano restano) e cancella le
    // righe rimaste vuote. Restituisce quante righe sono cambiate.
    public function clearHealthValues($userId) {
        // Le assegnazioni vanno da sinistra a destra: health_fields si azzera per ultimo
        $stmt = $this->conn->prepare("UPDATE " . $this->table_name . " SET
                weight = IF(FIND_IN_SET('weight', health_fields), NULL, weight),
                body_fat_percentage = IF(FIND_IN_SET('body_fat_percentage', health_fields), NULL, body_fat_percentage),
                waist_size = IF(FIND_IN_SET('waist_size', health_fields), NULL, waist_size),
                health_fields = ''
            WHERE user_id = ? AND health_fields <> ''");
        $stmt->execute(array((int) $userId));
        $changed = $stmt->rowCount();

        $conditions = implode(' AND ', array_map(function ($field) { return "$field IS NULL"; }, self::ALL_FIELDS));
        $this->conn->prepare("DELETE FROM " . $this->table_name . " WHERE user_id = ? AND $conditions")
            ->execute(array((int) $userId));
        return $changed;
    }

    // Numero o null: stringa vuota, null e valori non numerici non si salvano (lo 0 sì)
    private static function toNumber($value) {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        return round((float) $value, 2);
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
            $this->health_fields = $row['health_fields'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
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
