<?php
// Token Bearer per l'autenticazione dei client mobile (React Native).
// Il token in chiaro non viene mai salvato: solo il suo hash SHA-256.
// Policy di scadenza: sliding expiration — ogni uso valido sposta avanti expires_at,
// così un utente attivo non viene mai disconnesso a sorpresa (es. a metà allenamento).
class ApiToken
{
    private $conn;
    private $table_name = "gym_api_tokens";

    // Durata della finestra di validità, rinnovata ad ogni uso valido.
    const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 giorni

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Crea un nuovo token per l'utente e ne ritorna il valore in chiaro (unica occasione
    // in cui è disponibile: dopo questa chiamata solo l'hash resta salvato).
    public function create($user_id, $device_info = null)
    {
        $plain_token = bin2hex(random_bytes(32));
        $token_hash = hash('sha256', $plain_token);
        $expires_at = date('Y-m-d H:i:s', time() + self::TTL_SECONDS);

        $query = "INSERT INTO " . $this->table_name . "
                SET
                    user_id = :user_id,
                    token_hash = :token_hash,
                    device_info = :device_info,
                    expires_at = :expires_at";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':token_hash', $token_hash);
        $stmt->bindParam(':device_info', $device_info);
        $stmt->bindParam(':expires_at', $expires_at);

        if (!$stmt->execute()) {
            error_log("ApiToken::create fallita per user_id {$user_id}");
            return false;
        }

        return [
            'token' => $plain_token,
            'expires_at' => $expires_at,
        ];
    }

    // Valida un token in chiaro: se valido (esiste, non revocato, non scaduto) rinnova
    // la scadenza (sliding expiration) e ritorna lo user_id associato, altrimenti null.
    public function findValidByToken($plain_token)
    {
        if (!$plain_token) {
            return null;
        }

        $token_hash = hash('sha256', $plain_token);

        $query = "SELECT id, user_id
                FROM " . $this->table_name . "
                WHERE token_hash = ?
                    AND revoked_at IS NULL
                    AND expires_at > NOW()
                LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $token_hash);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        // Sliding expiration: l'uso valido rinnova la finestra.
        $new_expires_at = date('Y-m-d H:i:s', time() + self::TTL_SECONDS);
        $update = $this->conn->prepare(
            "UPDATE " . $this->table_name . " SET expires_at = :expires_at WHERE id = :id"
        );
        $update->bindParam(':expires_at', $new_expires_at);
        $update->bindParam(':id', $row['id']);
        $update->execute();

        return (int)$row['user_id'];
    }

    // Revoca un token (logout esplicito). Idempotente: revocare due volte non è un errore.
    public function revoke($plain_token)
    {
        if (!$plain_token) {
            return false;
        }

        $token_hash = hash('sha256', $plain_token);

        $query = "UPDATE " . $this->table_name . "
                SET revoked_at = NOW()
                WHERE token_hash = ? AND revoked_at IS NULL";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $token_hash);

        return $stmt->execute();
    }
}
