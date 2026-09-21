<?php
// Consensi dell'utente (tabella gym_consents). Una riga per ogni concessione: la revoca imposta
// revoked_at, cosi' resta traccia di quando e per quale versione del testo e' stato dato il consenso.
class Consent
{
    private $conn;
    private $table_name = "gym_consents";

    // Finalita' gestite da questo backend e versione corrente del testo che l'utente accetta.
    // Cambiare la versione di una finalita' significa chiedere di nuovo il consenso.
    const VERSIONS = array(
        'terms' => '2026-09',        // termini d'uso e informativa privacy
        'health_data' => '2026-09',  // misure corporee: dati sulla salute (art. 9 GDPR)
    );

    // Finalita' che l'utente puo' revocare da solo. I termini si ritirano cancellando l'account.
    const REVOCABLE = array('health_data');

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public static function isKnownPurpose($purpose)
    {
        return is_string($purpose) && array_key_exists($purpose, self::VERSIONS);
    }

    // True se esiste un consenso attivo (non revocato) per la finalita'. Con $currentVersionOnly
    // il consenso deve riguardare la versione corrente del testo.
    public function isActive($user_id, $purpose, $currentVersionOnly = true)
    {
        $sql = "SELECT 1 FROM " . $this->table_name . " WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL";
        $params = array($user_id, $purpose);
        if ($currentVersionOnly && isset(self::VERSIONS[$purpose])) {
            $sql .= " AND version = ?";
            $params[] = self::VERSIONS[$purpose];
        }
        $stmt = $this->conn->prepare($sql . " LIMIT 1");
        $stmt->execute($params);
        return (bool)$stmt->fetchColumn();
    }

    // Registra il consenso per la versione corrente. Se e' gia' attivo non fa nulla; un consenso
    // attivo per una versione precedente viene chiuso e sostituito.
    public function grant($user_id, $purpose, $version = null)
    {
        $version = $version ?: self::VERSIONS[$purpose];
        if ($this->isActive($user_id, $purpose, false)) {
            $stmt = $this->conn->prepare(
                "SELECT version FROM " . $this->table_name . " WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL LIMIT 1"
            );
            $stmt->execute(array($user_id, $purpose));
            if ($stmt->fetchColumn() === $version) {
                return true;
            }
            $this->closeActive($user_id, $purpose);
        }
        $stmt = $this->conn->prepare("INSERT INTO " . $this->table_name . " (user_id, purpose, version) VALUES (?, ?, ?)");
        return $stmt->execute(array($user_id, $purpose, $version));
    }

    // Revoca il consenso. Per health_data cancella anche le misure corporee dell'utente: senza
    // consenso non c'e' piu' una base giuridica per conservarle (art. 17.1.b GDPR).
    // Ritorna il numero di misure cancellate.
    public function revoke($user_id, $purpose)
    {
        $deleted = 0;
        $this->conn->beginTransaction();
        try {
            $this->closeActive($user_id, $purpose);
            if ($purpose === 'health_data') {
                $stmt = $this->conn->prepare("DELETE FROM gym_user_stats WHERE user_id = ?");
                $stmt->execute(array($user_id));
                $deleted = $stmt->rowCount();
            }
            $this->conn->commit();
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
        return $deleted;
    }

    private function closeActive($user_id, $purpose)
    {
        $stmt = $this->conn->prepare(
            "UPDATE " . $this->table_name . " SET revoked_at = NOW() WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL"
        );
        $stmt->execute(array($user_id, $purpose));
    }

    // Stato di tutte le finalita' gestite: granted (sulla versione corrente), versione e data.
    public function status($user_id)
    {
        $out = array();
        foreach (self::VERSIONS as $purpose => $current) {
            $stmt = $this->conn->prepare(
                "SELECT version, granted_at FROM " . $this->table_name . "
                 WHERE user_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1"
            );
            $stmt->execute(array($user_id, $purpose));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $out[$purpose] = array(
                'granted' => (bool)($row && $row['version'] === $current),
                'version' => $row ? $row['version'] : null,
                'current_version' => $current,
                'granted_at' => $row ? $row['granted_at'] : null,
            );
        }
        return $out;
    }
}
