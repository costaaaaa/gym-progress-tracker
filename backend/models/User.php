<?php
class User
{
    // Database connection and table name
    private $conn;
    private $table_name = "gym_users";

    // Object properties
    public $id;
    public $username;
    public $email;
    public $password;
    public $created_at;
    public $updated_at;
    public $rest_timer_enabled; // Preferenza timer di recupero nella modalità Focus
    public $password_changed_at;
    public $age;
    public $gender;
    public $experience_years;
    public $birth_date;
    public $training_start_date;

    // Helper per calcolare l'età dalla data di nascita
    public function calculateAge()
    {
        if (!$this->birth_date) return null;
        $birthDate = new DateTime($this->birth_date);
        $today = new DateTime();
        return $today->diff($birthDate)->y;
    }

    // Helper per calcolare gli anni di esperienza dalla data di inizio allenamento
    public function calculateExperienceYears()
    {
        if (!$this->training_start_date) return 0;
        $startDate = new DateTime($this->training_start_date);
        $today = new DateTime();
        $diff = $today->diff($startDate);
        // Calcola anni + frazione di anno (mesi / 12)
        return $diff->y + round($diff->m / 12, 1);
    }

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Create new user record
    public function create()
    {
        try {
            // Validate inputs
            if (!$this->validateInputs()) {
                error_log("User validation failed for username: {$this->username}");
                return false;
            }

            // Sanitize inputs (la password NON va sanitizzata: viene hashata, mai stampata)
            $this->username = htmlspecialchars(strip_tags($this->username));
            $this->email = htmlspecialchars(strip_tags($this->email));

            // Check if username or email already exists
            if ($this->usernameExists() || $this->emailExists()) {
                error_log("Username or email already exists for: {$this->username}");
                return false;
            }

            // Hash the password with bcrypt before storing
            $password_hash = password_hash($this->password, PASSWORD_BCRYPT);

            // Query to insert record
            $query = "INSERT INTO " . $this->table_name . "
                    SET
                        username = :username,
                        email = :email,
                        password = :password,
                        birth_date = :birth_date,
                        gender = :gender,
                        training_start_date = :training_start_date";

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Bind values
            $stmt->bindParam(":username", $this->username);
            $stmt->bindParam(":email", $this->email);
            $stmt->bindParam(":password", $password_hash);
            $stmt->bindParam(":birth_date", $this->birth_date);
            $stmt->bindParam(":gender", $this->gender);
            $stmt->bindParam(":training_start_date", $this->training_start_date);

            // Execute query
            if ($stmt->execute()) {
                $this->id = $this->conn->lastInsertId();
                return true;
            }

            error_log("Failed to execute user creation query for username: {$this->username}");
            return false;
        } catch (PDOException $e) {
            error_log("Database error during user creation: " . $e->getMessage());
            throw $e;
        }
    }

    // Check if username exists
    public function usernameExists()
    {
        $query = "SELECT id, username, password
                FROM " . $this->table_name . "
                WHERE username = ?
                LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->username);
        $stmt->execute();

        return $stmt->rowCount() > 0;
    }

    // Check if email exists
    public function emailExists()
    {
        $query = "SELECT id, username, password
                FROM " . $this->table_name . "
                WHERE email = ?
                LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->email);
        $stmt->execute();

        return $stmt->rowCount() > 0;
    }

    // Validate user inputs
    private function validateInputs()
    {
        // Validate username (alphanumeric, 3-50 characters)
        if (!preg_match('/^[a-zA-Z0-9]{3,50}$/', $this->username)) {
            error_log("Username validation failed: {$this->username} - Must be alphanumeric, 3-50 characters");
            return false;
        }

        // Validate email
        if (!filter_var($this->email, FILTER_VALIDATE_EMAIL)) {
            error_log("Email validation failed: {$this->email} - Invalid email format");
            return false;
        }

        // Validate password (at least 8 characters)
        if (strlen($this->password) < 8) {
            error_log("Password validation failed for user {$this->username} - Must be at least 8 characters");
            return false;
        }

        return true;
    }

    // Login user
    public function login()
    {
        // Query to read single record
        $query = "SELECT id, username, email, password, password_legacy
                FROM " . $this->table_name . "
                WHERE username = ?
                LIMIT 0,1";

        // Prepare query statement
        $stmt = $this->conn->prepare($query);

        // Bind username
        $stmt->bindParam(1, $this->username);

        // Execute query
        $stmt->execute();

        // Get retrieved row
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        // If user exists, verify password
        if ($row) {
            $this->id = $row['id'];
            $this->username = $row['username'];
            $this->email = $row['email'];

            if ($this->verifyPassword($this->password, $row['password'], (bool)$row['password_legacy'])) {
                // Hash legacy (bcrypt di SHA-256): al primo accesso torna a un bcrypt normale
                if ($row['password_legacy']) {
                    $this->persistPasswordHash(password_hash($this->password, PASSWORD_BCRYPT));
                }
                $this->touchLastLogin();
                return true;
            }
        }

        return false;
    }

    // Verifica una password in chiaro contro l'hash salvato. Con $legacy = true l'hash e'
    // bcrypt(sha256(password)): e' il vecchio SHA-256 senza salt avvolto in bcrypt dallo
    // script tools/wrap_legacy_hashes.php.
    private function verifyPassword($plain_password, $stored_hash, $legacy = false)
    {
        if ($legacy) {
            return password_verify(hash('sha256', $plain_password), $stored_hash);
        }
        return password_verify($plain_password, $stored_hash);
    }

    // Aggiorna l'hash della password salvato e azzera il flag legacy.
    private function persistPasswordHash($password_hash)
    {
        $query = "UPDATE " . $this->table_name . " SET password = :password, password_legacy = 0, updated_at = NOW() WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':id', $this->id);
        $stmt->execute();
    }

    // Registra l'ultimo accesso (serve alla conservazione dei dati).
    private function touchLastLogin()
    {
        $stmt = $this->conn->prepare("UPDATE " . $this->table_name . " SET last_login_at = NOW() WHERE id = ?");
        $stmt->bindParam(1, $this->id);
        $stmt->execute();
    }

    // Get user by ID
    public function readOne()
    {
        // Query to read single record
        $query = "SELECT id, username, email, created_at, updated_at
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
            $this->username = $row['username'];
            $this->email = $row['email'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];
            return true;
        }

        return false;
    }

    // Change user password
    public function changePassword($current_password, $new_password)
    {
        // Controlliamo prima che l'utente esista e l'ID sia valido
        if (!$this->id) {
            error_log("Change password failed: No user ID provided");
            return false;
        }

        // Verifichiamo che la nuova password sia diversa dalla password attuale
        if ($current_password === $new_password) {
            error_log("Change password failed: New password is the same as current password for user ID {$this->id}");
            return false;
        }

        // Recuperiamo la password corrente dal database
        $query = "SELECT password, password_legacy FROM " . $this->table_name . " WHERE id = ? LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            error_log("Change password failed: user not found");
            return false;
        }

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $saved_password = $row['password'];

        // Verifichiamo che la password corrente sia corretta
        if (!$this->verifyPassword($current_password, $saved_password, (bool)$row['password_legacy'])) {
            error_log("Change password failed: current password is incorrect");
            return false;
        }

        // La nuova password viene sempre salvata come hash bcrypt
        $password_hash = password_hash($new_password, PASSWORD_BCRYPT);

        // Aggiorniamo la password nel database
        $query = "UPDATE " . $this->table_name . " SET password = :password, password_legacy = 0, password_changed_at = NOW(), updated_at = NOW() WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        // Bind parameters
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':id', $this->id);

        // Eseguiamo la query
        if ($stmt->execute()) {
            return true;
        }

        error_log("Change password failed: Database error for user ID {$this->id}");
        return false;
    }
    public function readById($id)
    {
        $query = "SELECT id, username, email, created_at, rest_timer_enabled, birth_date, gender, training_start_date, password_changed_at FROM " . $this->table_name . " WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $id);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $this->id = $row['id'];
            $this->username = $row['username'];
            $this->email = $row['email'];
            $this->created_at = $row['created_at'];
            $this->rest_timer_enabled = (bool)$row['rest_timer_enabled'];
            $this->birth_date = $row['birth_date'];
            $this->gender = $row['gender'];
            $this->training_start_date = $row['training_start_date'];
            $this->password_changed_at = $row['password_changed_at'];
            
            // Calcolo dinamico per il frontend
            $this->age = $this->calculateAge();
            $this->experience_years = $this->calculateExperienceYears();
            return true;
        }
        return false;
    }

    // Aggiorna le impostazioni del profilo dell'utente. Aggiornamento parziale: si scrivono
    // solo le chiavi presenti in $fields (rest_timer_enabled, birth_date, gender,
    // training_start_date); quelle assenti restano come sono.
    public function updateProfile(array $fields)
    {
        if (!$this->id) {
            error_log("Update profile failed: No user ID provided");
            return false;
        }

        $allowed = array('rest_timer_enabled', 'birth_date', 'gender', 'training_start_date');
        $sets = array();
        $values = array();
        foreach ($allowed as $column) {
            if (array_key_exists($column, $fields)) {
                $sets[] = "$column = :$column";
                $values[$column] = ($column === 'rest_timer_enabled')
                    ? ($fields[$column] ? 1 : 0)
                    : $fields[$column];
            }
        }
        if (empty($sets)) {
            return true;
        }

        $query = "UPDATE " . $this->table_name . " SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        foreach ($values as $column => $value) {
            $stmt->bindValue(":$column", $value, $column === 'rest_timer_enabled' ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':id', $this->id, PDO::PARAM_INT);

        if ($stmt->execute()) {
            // Rilegge il profilo: rest_timer_enabled, data, sesso, eta' e anni di esperienza aggiornati
            return $this->readById($this->id);
        }

        error_log("Update profile failed: Database error for user ID {$this->id}");
        return false;
    }

    // Delete user account
    public function deleteAccount($password)
    {
        // Controlliamo prima che l'utente esista e l'ID sia valido
        if (!$this->id) {
            error_log("Delete account failed: No user ID provided");
            return false;
        }

        // Recuperiamo la password corrente dal database
        $query = "SELECT password, password_legacy FROM " . $this->table_name . " WHERE id = ? LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            error_log("Delete account failed: user not found");
            return false;
        }

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $saved_password = $row['password'];

        // Verifichiamo che la password sia corretta
        if (!$this->verifyPassword($password, $saved_password, (bool)$row['password_legacy'])) {
            error_log("Delete account failed: password is incorrect");
            return false;
        }

        try {
            // Iniziamo una transazione per garantire l'integrità dei dati.
            // I dati correlati sono rimossi dai vincoli ON DELETE CASCADE.
            $this->conn->beginTransaction();

            $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->id);

            if ($stmt->execute() && $stmt->rowCount() === 1) {
                $this->conn->commit();
                return true;
            }

            $this->conn->rollBack();
            error_log("Delete account failed: Database error for user ID {$this->id}");
            return false;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            error_log("Delete account failed: " . $e->getMessage());
            return false;
        }
    }
}
