<?php
// Codici di registrazione (tabelle gym_signup_codes e gym_signup_code_uses). Regole pure in
// lib/signup_code_rules.php; qui solo l'accesso al database e i blocchi.
// Blocchi: la riga del codice (FOR UPDATE) serializza chi prende l'ultimo posto in registrazione, chi conferma
// dopo i 7 giorni e chi cambia i posti dall'admin. Ordine dei blocchi: utente -> uso -> codice (alla conferma);
// codice -> nuovo utente (alla registrazione, dove la riga dell'utente ancora non esiste): non si incrociano.
require_once __DIR__ . '/../lib/signup_code_rules.php';

class SignupCode
{
    // Orologio del database: un solo istante per tutto il confronto (come created_at e i codici email)
    private static function dbNow($conn)
    {
        return (int)$conn->query("SELECT UNIX_TIMESTAMP()")->fetchColumn();
    }

    private static function findByCode($conn, $code, $forUpdate)
    {
        $stmt = $conn->prepare("SELECT id, code, tier, duration_days, max_uses, expires_at, enabled, assignee
                                FROM gym_signup_codes WHERE code = ? LIMIT 1" . ($forUpdate ? " FOR UPDATE" : ""));
        $stmt->execute([$code]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private static function findById($conn, $id, $forUpdate)
    {
        $stmt = $conn->prepare("SELECT id, code, tier, duration_days, max_uses, expires_at, enabled, assignee, created_at, updated_at
                                FROM gym_signup_codes WHERE id = ? LIMIT 1" . ($forUpdate ? " FOR UPDATE" : ""));
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // Usi che possono occupare un posto di ciascun codice di $ids: id codice => elenco per signupCodeSeatsTaken
    private static function seatUses($conn, array $ids)
    {
        $out = array();
        if (!$ids) {
            return $out;
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $conn->prepare(
            "SELECT s.code_id, s.status, g.id IS NOT NULL AS user_exists, UNIX_TIMESTAMP(g.created_at) AS created_ts
             FROM gym_signup_code_uses s LEFT JOIN gym_users g ON g.id = s.user_id
             WHERE s.code_id IN ($in) AND (s.status = 'applied' OR (s.status = 'pending' AND s.user_id IS NOT NULL))"
        );
        $stmt->execute(array_values($ids));
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out[(int)$r['code_id']][] = array(
                'status' => $r['status'],
                'user_exists' => (int)$r['user_exists'] === 1,
                'user_created_ts' => $r['created_ts'] === null ? null : (int)$r['created_ts'],
            );
        }
        return $out;
    }

    public static function seatsTaken($conn, $code_id)
    {
        $uses = self::seatUses($conn, array((int)$code_id));
        return signupCodeSeatsTaken($uses[(int)$code_id] ?? array(), self::dbNow($conn));
    }

    // Controllo senza blocchi né posti occupati (controllo anticipato del modulo). Ritorna
    // ['status' => 'ok', 'tier', 'duration_days'] oppure ['status' => 'invalid'|'expired'|'exhausted'].
    public static function check($conn, $raw)
    {
        $normalized = signupCodeNormalize($raw);
        $row = $normalized === null ? null : self::findByCode($conn, $normalized, false);
        $status = signupCodeRegistrationCheck($row, $row === null ? 0 : self::seatsTaken($conn, $row['id']), gmdate('Y-m-d H:i:s', self::dbNow($conn)));
        if ($status !== 'ok') {
            return array('status' => $status);
        }
        return array('status' => 'ok', 'tier' => $row['tier'], 'duration_days' => $row['duration_days'] === null ? null : (int)$row['duration_days']);
    }

    // Registrazione, primo passo: apre la transazione (READ COMMITTED, come le altre operazioni sull'account),
    // blocca la riga del codice e controlla che si possa usare. Se si può ritorna ['status' => 'ok', 'code' => riga]
    // e la transazione RESTA APERTA (il chiamante crea l'utente, chiama recordPendingUse() e fa commit); altrimenti
    // ritorna ['status' => 'invalid'|'expired'|'exhausted'] dopo il rollback.
    public static function lockForRegistration($conn, $raw)
    {
        $conn->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        $conn->beginTransaction();
        $normalized = signupCodeNormalize($raw);
        $row = $normalized === null ? null : self::findByCode($conn, $normalized, true);
        $status = signupCodeRegistrationCheck($row, $row === null ? 0 : self::seatsTaken($conn, $row['id']), gmdate('Y-m-d H:i:s', self::dbNow($conn)));
        if ($status !== 'ok') {
            $conn->rollBack();
            return array('status' => $status);
        }
        return array('status' => 'ok', 'code' => $row);
    }

    // Registrazione, ultimo passo (nella stessa transazione, dopo la creazione dell'utente)
    public static function recordPendingUse($conn, $code_id, $user_id)
    {
        $conn->prepare("INSERT INTO gym_signup_code_uses (code_id, user_id, status) VALUES (?, ?, 'pending')")
            ->execute([(int)$code_id, (int)$user_id]);
    }

    // Alla conferma dell'email (chiamata da EmailVerification::markVerified, dentro la sua transazione e con
    // la riga dell'utente già bloccata): se l'utente ha un uso 'pending' applica la regola, aggiorna
    // tier/tier_until e l'uso. Ritorna null senza uso, altrimenti ['status' => 'applied'|'missed', 'tier'
    // (livello del codice), 'tier_last_day' (ultimo giorno del livello dell'account in ora italiana, o null se
    // non scade o se missed)].
    public static function applyOnConfirm($conn, $user_id)
    {
        $stmt = $conn->prepare("SELECT id, code_id FROM gym_signup_code_uses WHERE user_id = ? AND status = 'pending' FOR UPDATE");
        $stmt->execute([(int)$user_id]);
        $use = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$use) {
            return null;
        }
        $code = self::findById($conn, $use['code_id'], true);
        $now = self::dbNow($conn);
        $u = $conn->prepare("SELECT tier, tier_until, UNIX_TIMESTAMP(created_at) AS created_ts FROM gym_users WHERE id = ? FOR UPDATE");
        $u->execute([(int)$user_id]);
        $user = $u->fetch(PDO::FETCH_ASSOC);

        // L'uso di questo utente è 'pending' e dopo i 7 giorni non occupa nulla (regola): entro i 7 giorni
        // l'esito non guarda i posti, dopo non c'è bisogno di escluderlo
        $taken = 0;
        if ($code !== null) {
            $uses = self::seatUses($conn, array((int)$code['id']));
            $taken = signupCodeSeatsTaken($uses[(int)$code['id']] ?? array(), $now);
        }
        $outcome = signupCodeConfirmOutcome($code, $taken, (int)$user['created_ts'], $now);

        $lastDay = null;
        if ($outcome === 'applied') {
            $r = signupCodeTierOutcome($code['tier'], $code['duration_days'] === null ? null : (int)$code['duration_days'],
                $user['tier'], $user['tier_until'], $now);
            if ($r['changed']) {
                $conn->prepare("UPDATE gym_users SET tier = ?, tier_until = ? WHERE id = ?")->execute([$r['tier'], $r['until'], (int)$user_id]);
            }
            $lastDay = tierLastDay($r['until']);
        }
        $conn->prepare("UPDATE gym_signup_code_uses SET status = ?, applied_at = " . ($outcome === 'applied' ? "NOW()" : "NULL") . " WHERE id = ?")
            ->execute([$outcome, (int)$use['id']]);
        return array('status' => $outcome, 'tier' => $code === null ? null : $code['tier'], 'tier_last_day' => $lastDay);
    }

    // Livello salvato dell'utente per user/read.php: ['tier_until' => ISO UTC o null, 'tier_last_day' => AAAA-MM-GG o null],
    // entrambi null se il livello in vigore è free o non scade.
    public static function tierDates($conn, $user_id)
    {
        $stmt = $conn->prepare("SELECT tier, tier_until FROM gym_users WHERE id = ? LIMIT 1");
        $stmt->execute([(int)$user_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || tierEffective($row['tier'], $row['tier_until'], gmdate('Y-m-d H:i:s')) === 'free' || $row['tier_until'] === null) {
            return array('tier_until' => null, 'tier_last_day' => null);
        }
        return array(
            'tier_until' => (new DateTimeImmutable($row['tier_until'], new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z'),
            'tier_last_day' => tierLastDay($row['tier_until']),
        );
    }

    // L'uso dell'utente per user/read.php: null o ['status', 'tier', 'duration_days']
    public static function useOf($conn, $user_id)
    {
        $stmt = $conn->prepare("SELECT s.status, c.tier, c.duration_days FROM gym_signup_code_uses s
                                JOIN gym_signup_codes c ON c.id = s.code_id WHERE s.user_id = ? LIMIT 1");
        $stmt->execute([(int)$user_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return array('status' => $row['status'], 'tier' => $row['tier'], 'duration_days' => $row['duration_days'] === null ? null : (int)$row['duration_days']);
    }
}
