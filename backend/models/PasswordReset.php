<?php
// Token di recupero password. Il token in chiaro viaggia solo nell'email: nel database resta
// l'hash SHA-256. Monouso, scadenza breve, un solo token attivo per utente.
class PasswordReset
{
    private $conn;
    private $table_name = "gym_password_resets";

    // Validità del link di reset.
    const TTL_SECONDS = 3600; // 1 ora

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Formato atteso del token in chiaro: 64 caratteri esadecimali.
    public static function isWellFormed($token)
    {
        return is_string($token) && preg_match('/^[0-9a-f]{64}$/', $token) === 1;
    }

    // Trova l'utente per email. Ritorna ['id' => ..., 'username' => ...] o null.
    public function findUserByEmail($email)
    {
        $stmt = $this->conn->prepare("SELECT id, username FROM gym_users WHERE email = ? LIMIT 1");
        $stmt->bindParam(1, $email);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // Invalida i token precedenti dell'utente e ne crea uno nuovo. Ritorna il token in chiaro.
    public function create($user_id)
    {
        $plain_token = bin2hex(random_bytes(32));
        $token_hash = hash('sha256', $plain_token);
        $expires_at = date('Y-m-d H:i:s', time() + self::TTL_SECONDS);

        $this->conn->beginTransaction();
        try {
            $this->invalidateForUser($user_id);
            $stmt = $this->conn->prepare(
                "INSERT INTO " . $this->table_name . " (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
            );
            $stmt->execute([$user_id, $token_hash, $expires_at]);
            $this->conn->commit();
        } catch (Exception $e) {
            $this->conn->rollBack();
            throw $e;
        }

        return $plain_token;
    }

    // Segna come usati tutti i token ancora attivi dell'utente.
    private function invalidateForUser($user_id)
    {
        $stmt = $this->conn->prepare(
            "UPDATE " . $this->table_name . " SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL"
        );
        $stmt->execute([$user_id]);
    }

    // Consuma il token e imposta la nuova password in un'unica transazione. Ritorna true solo se
    // il token esiste, non è scaduto e non è già stato usato. Revoca anche i token mobile attivi.
    public function consumeAndSetPassword($plain_token, $new_password)
    {
        if (!self::isWellFormed($plain_token)) {
            return false;
        }
        $token_hash = hash('sha256', $plain_token);

        $this->conn->beginTransaction();
        try {
            $stmt = $this->conn->prepare(
                "SELECT id, user_id FROM " . $this->table_name . "
                 WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
                 LIMIT 1 FOR UPDATE"
            );
            $stmt->execute([$token_hash]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                $this->conn->rollBack();
                return false;
            }

            $password_hash = password_hash($new_password, PASSWORD_BCRYPT);
            $upd = $this->conn->prepare(
                "UPDATE gym_users SET password = ?, password_changed_at = NOW(), updated_at = NOW() WHERE id = ?"
            );
            $upd->execute([$password_hash, $row['user_id']]);

            $this->invalidateForUser($row['user_id']);
            (new ApiToken($this->conn))->revokeAllForUser($row['user_id']);

            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
    }
}
