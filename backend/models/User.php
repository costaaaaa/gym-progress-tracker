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
        $query = "SELECT id, username, email, password
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

            // Verifica standard contro l'hash bcrypt
            if (password_verify($this->password, $row['password'])) {
                return true;
            }

            // Legacy: password salvata come SHA-256 grezzo (client-side hashing).
            // Se combacia, migra in modo trasparente a bcrypt.
            if (hash_equals($row['password'], hash('sha256', $this->password))) {
                $this->persistPasswordHash(password_hash($this->password, PASSWORD_BCRYPT));
                return true;
            }
        }

        return false;
    }

    // Verifica una password in chiaro contro l'hash salvato.
    // Supporta sia bcrypt (nuovo) sia il legacy SHA-256 grezzo lato client.
    private function verifyPassword($plain_password, $stored_hash)
    {
        if (password_verify($plain_password, $stored_hash)) {
            return true;
        }
        return hash_equals($stored_hash, hash('sha256', $plain_password));
    }

    // Aggiorna l'hash della password salvato (migrazione trasparente a bcrypt).
    private function persistPasswordHash($password_hash)
    {
        $query = "UPDATE " . $this->table_name . " SET password = :password, updated_at = NOW() WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':password', $password_hash);
        $stmt->bindParam(':id', $this->id);
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
        $query = "SELECT password FROM " . $this->table_name . " WHERE id = ? LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            error_log("Change password failed: User not found with ID {$this->id}");
            return false;
        }

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $saved_password = $row['password'];

        // Verifichiamo che la password corrente sia corretta
        if (!$this->verifyPassword($current_password, $saved_password)) {
            error_log("Change password failed: Current password is incorrect for user ID {$this->id}");
            return false;
        }

        // La nuova password viene sempre salvata come hash bcrypt
        $password_hash = password_hash($new_password, PASSWORD_BCRYPT);

        // Aggiorniamo la password nel database
        $query = "UPDATE " . $this->table_name . " SET password = :password, updated_at = NOW() WHERE id = :id";

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
        $query = "SELECT id, username, email, created_at, rest_timer_enabled, birth_date, gender, training_start_date FROM " . $this->table_name . " WHERE id = ? LIMIT 1";
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
            
            // Calcolo dinamico per il frontend
            $this->age = $this->calculateAge();
            $this->experience_years = $this->calculateExperienceYears();
            return true;
        }
        return false;
    }

    // Aggiorna le impostazioni del profilo dell'utente
    public function updateProfile($rest_timer_enabled, $birth_date = null, $gender = null, $training_start_date = null)
    {
        if (!$this->id) {
            error_log("Update profile failed: No user ID provided");
            return false;
        }

        $query = "UPDATE " . $this->table_name . " 
                 SET rest_timer_enabled = :rest_timer_enabled, 
                     birth_date = :birth_date, 
                     gender = :gender, 
                     training_start_date = :training_start_date,
                     updated_at = NOW() 
                 WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        $timer_value = $rest_timer_enabled ? 1 : 0;
        $stmt->bindParam(':rest_timer_enabled', $timer_value, PDO::PARAM_INT);
        $stmt->bindParam(':birth_date', $birth_date);
        $stmt->bindParam(':gender', $gender);
        $stmt->bindParam(':training_start_date', $training_start_date);
        $stmt->bindParam(':id', $this->id);

        if ($stmt->execute()) {
            $this->rest_timer_enabled = (bool)$rest_timer_enabled;
            $this->birth_date = $birth_date;
            $this->gender = $gender;
            $this->training_start_date = $training_start_date;
            
            // Aggiorna i calcoli
            $this->age = $this->calculateAge();
            $this->experience_years = $this->calculateExperienceYears();
            return true;
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
        $query = "SELECT password FROM " . $this->table_name . " WHERE id = ? LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            error_log("Delete account failed: User not found with ID {$this->id}");
            return false;
        }

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $saved_password = $row['password'];

        // Verifichiamo che la password sia corretta
        if (!$this->verifyPassword($password, $saved_password)) {
            error_log("Delete account failed: Password is incorrect for user ID {$this->id}");
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
