<?php
// Token di recupero password. Il token in chiaro viaggia solo nell'email: nel database resta
// l'hash SHA-256. Monouso, scadenza breve, un solo token attivo per utente.
class PasswordReset
{
    private $conn;
    private $table_name = "gym_password_resets";

    // Validità del link di reset.
    const TTL_SECONDS = 3600; // 1 ora

    // Un link attivo creato da meno di così non viene sostituito da una nuova richiesta.
    const RECENT_SECONDS = 900; // 15 minuti

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
        $stmt = $this->conn->prepare("SELECT id, username, locale FROM gym_users WHERE email = ? LIMIT 1");
        $stmt->bindParam(1, $email);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // True se $age_seconds (età di un link) è dentro la finestra RECENT_SECONDS.
    public static function isRecent($age_seconds)
    {
        return $age_seconds >= 0 && $age_seconds < self::RECENT_SECONDS;
    }

    // Crea un link di reset per l'utente, salvo che ne abbia già uno attivo (non usato, non scaduto)
    // creato da meno di RECENT_SECONDS. Ritorna il token in chiaro, oppure null se esiste già un link
    // recente. Controllo e creazione stanno in una transazione che blocca la riga dell'utente: due
    // richieste contemporanee per lo stesso account si accodano e la seconda vede il link della prima.
    // L'età si calcola nel database, con lo stesso orologio di created_at.
    public function createUnlessRecent($user_id)
    {
        $this->beginReadCommitted();
        try {
            if (!$this->lockUser($user_id)) {
                $this->conn->rollBack();
                return null;
            }

            $stmt = $this->conn->prepare(
                "SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) FROM " . $this->table_name . "
                 WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
                 ORDER BY created_at DESC, id DESC LIMIT 1"
            );
            $stmt->execute([$user_id]);
            $age = $stmt->fetchColumn();
            if ($age !== false && self::isRecent((int)$age)) {
                $this->conn->rollBack();
                return null;
            }

            $plain_token = bin2hex(random_bytes(32));
            $this->invalidateForUser($user_id);
            $ins = $this->conn->prepare(
                "INSERT INTO " . $this->table_name . " (user_id, token_hash, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL " . (int)self::TTL_SECONDS . " SECOND))"
            );
            $ins->execute([$user_id, hash('sha256', $plain_token)]);
            $this->conn->commit();
            return $plain_token;
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
    }

    // Apre una transazione READ COMMITTED. Con il livello predefinito l'UPDATE dei link di un utente
    // blocca l'intervallo dell'indice idx_reset_user_id fino al user_id successivo, e gli INSERT di
    // altri utenti in quell'intervallo aspettano: due richieste di account diversi possono bloccarsi
    // a vicenda. Restano i blocchi di intervallo dei controlli di chiave esterna e di chiave duplicata.
    private function beginReadCommitted()
    {
        $this->conn->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        $this->conn->beginTransaction();
    }

    // Blocca la riga dell'utente fino alla fine della transazione. Ritorna false se non esiste più.
    private function lockUser($user_id)
    {
        $stmt = $this->conn->prepare("SELECT id FROM gym_users WHERE id = ? FOR UPDATE");
        $stmt->execute([$user_id]);
        return $stmt->fetchColumn() !== false;
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
    // I blocchi si prendono nello stesso ordine di createUnlessRecent(): prima la riga dell'utente
    // (il suo id si legge senza blocco), poi quella del link. Con l'ordine inverso un cambio password
    // e una nuova richiesta per lo stesso account potrebbero bloccarsi a vicenda.
    public function consumeAndSetPassword($plain_token, $new_password)
    {
        if (!self::isWellFormed($plain_token)) {
            return false;
        }
        $token_hash = hash('sha256', $plain_token);

        $find = $this->conn->prepare(
            "SELECT user_id FROM " . $this->table_name . "
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
             LIMIT 1"
        );
        $find->execute([$token_hash]);
        $user_id = $find->fetchColumn();
        if ($user_id === false) {
            return false;
        }

        $this->beginReadCommitted();
        try {
            if (!$this->lockUser($user_id)) {
                $this->conn->rollBack();
                return false;
            }

            // Riletto con blocco: dopo l'attesa il link può essere già stato invalidato.
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
                "UPDATE gym_users SET password = ?, password_legacy = 0, password_changed_at = NOW(), updated_at = NOW() WHERE id = ?"
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
