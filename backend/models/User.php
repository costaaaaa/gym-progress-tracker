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
    public $is_hashed; // Nuova proprietà per indicare se la password è già hashata
    public $rest_timer_enabled; // Preferenza timer di recupero nella modalità Focus
    public $age;
    public $gender;
    public $experience_years;

    // Constructor with database connection
    public function __construct($db)
    {
        $this->conn = $db;
        $this->is_hashed = false; // Default a false
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

            // Sanitize inputs
            $this->username = htmlspecialchars(strip_tags($this->username));
            $this->email = htmlspecialchars(strip_tags($this->email));
            $this->password = htmlspecialchars(strip_tags($this->password));

            // Check if username or email already exists
            if ($this->usernameExists() || $this->emailExists()) {
                error_log("Username or email already exists for: {$this->username}");
                return false;
            }

            // Se la password non è già hashata, hashala
            if (!$this->is_hashed) {
                // Hash the password
                $password_hash = password_hash($this->password, PASSWORD_BCRYPT);
            } else {
                // La password è già un hash SHA-256 dal client
                // Possiamo salvarla direttamente o aggiungere ulteriore sicurezza con un secondo hashing
                // In questo caso la salviamo direttamente per mantenere compatibilità con il login
                $password_hash = $this->password;
            }

            // Query to insert record
            $query = "INSERT INTO " . $this->table_name . "
                    SET
                        username = :username,
                        email = :email,
                        password = :password,
                        age = :age,
                        gender = :gender,
                        experience_years = :experience_years";

            // Prepare query
            $stmt = $this->conn->prepare($query);

            // Bind values
            $stmt->bindParam(":username", $this->username);
            $stmt->bindParam(":email", $this->email);
            $stmt->bindParam(":password", $password_hash);
            $stmt->bindParam(":age", $this->age);
            $stmt->bindParam(":gender", $this->gender);
            $stmt->bindParam(":experience_years", $this->experience_years);

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

            // Se la password è già stata hashata lato client
            if ($this->is_hashed) {
                // Verifica diretta dell'hash ricevuto con l'hash salvato nel DB
                // Questa verifica richiede che nel database vengano salvati
                // gli hash delle password e non password hashate con salt
                // Non è l'approccio ideale ma supporta il client-side hashing
                return hash_equals($this->password, $row['password']);
            } else {
                // Metodo standard: verifica la password con password_verify
                return password_verify($this->password, $row['password']);
            }
        }

        return false;
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
        $password_is_correct = false;

        // Se la password attuale è già hashata lato client
        if ($this->is_hashed) {
            $password_is_correct = hash_equals($current_password, $saved_password);
        } else {
            $password_is_correct = password_verify($current_password, $saved_password);
        }

        if (!$password_is_correct) {
            error_log("Change password failed: Current password is incorrect for user ID {$this->id}");
            return false;
        }

        // Se la nuova password non è già hashata, hashala
        $password_hash = $this->is_hashed ? $new_password : password_hash($new_password, PASSWORD_BCRYPT);

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
        $query = "SELECT id, username, email, created_at, rest_timer_enabled, age, gender, experience_years FROM " . $this->table_name . " WHERE id = ? LIMIT 1";
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
            $this->age = $row['age'];
            $this->gender = $row['gender'];
            $this->experience_years = $row['experience_years'];
            return true;
        }
        return false;
    }

    // Aggiorna le impostazioni del profilo dell'utente
    public function updateProfile($rest_timer_enabled, $age = null, $gender = null, $experience_years = null)
    {
        if (!$this->id) {
            error_log("Update profile failed: No user ID provided");
            return false;
        }

        $query = "UPDATE " . $this->table_name . " 
                 SET rest_timer_enabled = :rest_timer_enabled, 
                     age = :age, 
                     gender = :gender, 
                     experience_years = :experience_years,
                     updated_at = NOW() 
                 WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        $timer_value = $rest_timer_enabled ? 1 : 0;
        $stmt->bindParam(':rest_timer_enabled', $timer_value, PDO::PARAM_INT);
        $stmt->bindParam(':age', $age, PDO::PARAM_INT);
        $stmt->bindParam(':gender', $gender);
        $stmt->bindParam(':experience_years', $experience_years);
        $stmt->bindParam(':id', $this->id);

        if ($stmt->execute()) {
            $this->rest_timer_enabled = (bool)$rest_timer_enabled;
            $this->age = $age;
            $this->gender = $gender;
            $this->experience_years = $experience_years;
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
        $password_is_correct = false;

        // Se la password è già hashata lato client
        if ($this->is_hashed) {
            $password_is_correct = hash_equals($password, $saved_password);
        } else {
            $password_is_correct = password_verify($password, $saved_password);
        }

        if (!$password_is_correct) {
            error_log("Delete account failed: Password is incorrect for user ID {$this->id}");
            return false;
        }

        // Iniziamo una transazione per garantire l'integrità dei dati
        $this->conn->beginTransaction();

        try {
            // Eliminiamo prima i dati correlati (allenamenti, progressi, ecc.)
            // Nota: questo dipende dalla struttura del database e dalle relazioni
            // Qui assumiamo che ci siano tabelle correlate con chiavi esterne

            // Eliminiamo i dati degli allenamenti dell'utente
            $query = "DELETE FROM workout_history WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->id);
            $stmt->execute();

            // Eliminiamo le schede di allenamento dell'utente
            $query = "DELETE FROM workout_plans WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->id);
            $stmt->execute();

            // Eliminiamo i progressi dell'utente
            $query = "DELETE FROM progress WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->id);
            $stmt->execute();

            // Infine, eliminiamo l'account utente
            $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->id);

            if ($stmt->execute()) {
                // Confermiamo la transazione
                $this->conn->commit();
                return true;
            } else {
                // Annulliamo la transazione in caso di errore
                $this->conn->rollBack();
                error_log("Delete account failed: Database error for user ID {$this->id}");
                return false;
            }
        } catch (Exception $e) {
            // Annulliamo la transazione in caso di eccezione
            $this->conn->rollBack();
            error_log("Delete account failed: " . $e->getMessage());
            return false;
        }
    }
}
