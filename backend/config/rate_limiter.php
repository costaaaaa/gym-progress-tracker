<?php
// Rate limiter per gli endpoint di autenticazione (login/register).
//
// Semantica "fixed-window counter": un contatore per chiave con scadenza.
// In SQL è un singolo statement atomico (INSERT ... ON DUPLICATE KEY UPDATE),
// l'equivalente diretto di INCR + EXPIRE di Redis. Lo swap futuro a Redis (su VPS)
// cambia solo la classe dietro l'interfaccia: la logica degli endpoint resta identica.

interface RateLimiterInterface
{
    // true se la chiave ha raggiunto/superato $max tentativi nella finestra corrente
    public function tooManyAttempts($key, $max);

    // Incrementa il contatore della chiave; crea o azzera la finestra di $decaySeconds
    // se la chiave è assente o scaduta
    public function hit($key, $decaySeconds);

    // Rimuove il contatore della chiave (es. dopo un accesso riuscito)
    public function clear($key);

    // Secondi mancanti allo scadere della finestra corrente (0 se non bloccata)
    public function availableIn($key);
}

class DbRateLimiter implements RateLimiterInterface
{
    private $conn;
    private $table_name = "gym_rate_limits";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function tooManyAttempts($key, $max)
    {
        $query = "SELECT attempts FROM " . $this->table_name . "
                  WHERE rate_key = :key AND expires_at > NOW() LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':key', $key);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row && (int)$row['attempts'] >= $max;
    }

    public function hit($key, $decaySeconds)
    {
        // Statement atomico: resetta la finestra se scaduta, altrimenti incrementa.
        // I placeholder :decay/:decay2 sono distinti perché i prepared statement
        // nativi (ATTR_EMULATE_PREPARES = false) non consentono di riusare lo stesso nome.
        $query = "INSERT INTO " . $this->table_name . " (rate_key, attempts, expires_at)
                  VALUES (:key, 1, DATE_ADD(NOW(), INTERVAL :decay SECOND))
                  ON DUPLICATE KEY UPDATE
                    attempts   = IF(expires_at < NOW(), 1, attempts + 1),
                    expires_at = IF(expires_at < NOW(), DATE_ADD(NOW(), INTERVAL :decay2 SECOND), expires_at)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':key', $key);
        $stmt->bindParam(':decay', $decaySeconds, PDO::PARAM_INT);
        $stmt->bindParam(':decay2', $decaySeconds, PDO::PARAM_INT);
        $stmt->execute();

        // Purge opportunistico dei record scaduti: limitazione della conservazione
        // (l'IP non resta oltre la finestra) senza bisogno di un cron job.
        if (mt_rand(1, 100) <= 2) {
            $this->conn->exec("DELETE FROM " . $this->table_name . " WHERE expires_at < NOW()");
        }
    }

    public function clear($key)
    {
        $query = "DELETE FROM " . $this->table_name . " WHERE rate_key = :key";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':key', $key);
        $stmt->execute();
    }

    public function availableIn($key)
    {
        $query = "SELECT TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds
                  FROM " . $this->table_name . "
                  WHERE rate_key = :key AND expires_at > NOW() LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':key', $key);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? max(0, (int)$row['seconds']) : 0;
    }
}

// Factory: punto unico dove in futuro si aggiunge RedisRateLimiter (stessa interfaccia).
// Driver selezionabile via env RATE_LIMITER_DRIVER (default 'db').
function rate_limiter($db)
{
    $driver = getenv('RATE_LIMITER_DRIVER') ?: 'db';
    switch ($driver) {
        // case 'redis': return new RedisRateLimiter(...); // futuro, su VPS con Redis disponibile
        case 'db':
        default:
            return new DbRateLimiter($db);
    }
}

// Regole di throttling [max_tentativi, finestra_secondi], configurabili via env.
function rate_limit_rule($name)
{
    $rules = [
        // login per-IP: difesa brute-force globale per indirizzo
        'login_ip'    => [(int)(getenv('RL_LOGIN_IP_MAX')   ?: 20), (int)(getenv('RL_LOGIN_IP_DECAY')   ?: 900)],
        // login per IP+username: cap più stretto sul bersaglio specifico
        'login_user'  => [(int)(getenv('RL_LOGIN_USER_MAX') ?: 5),  (int)(getenv('RL_LOGIN_USER_DECAY') ?: 900)],
        // register per-IP: anti registrazioni di massa
        'register_ip' => [(int)(getenv('RL_REGISTER_MAX')   ?: 10), (int)(getenv('RL_REGISTER_DECAY')   ?: 3600)],
    ];
    return $rules[$name];
}
