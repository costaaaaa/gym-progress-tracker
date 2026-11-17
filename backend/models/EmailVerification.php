<?php
// Verifica dell'email con un codice di 6 cifre (tabella gym_email_codes) e cambio di indirizzo.
// Nel database resta solo l'hash sha256("<id utente>:<codice>"). Un solo codice attivo per utente.
// Ogni operazione prende il blocco sulla riga dell'utente (FOR UPDATE), come PasswordReset, così
// richieste parallele per lo stesso account si accodano. Regole pure in lib/email_verification_rules.php.
require_once __DIR__ . '/../lib/email_verification_rules.php';
require_once __DIR__ . '/SignupCode.php';

class EmailVerification
{
    private $conn;
    private $table_name = "gym_email_codes";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // L'UNICO punto che segna l'email come confermata e azzera gli avvisi di eliminazione: lo usano la
    // conferma con codice e il recupero password. Con $only_if_unverified non tocca un account già confermato
    // (recupero password). Va chiamato dentro una transazione con la riga dell'utente bloccata: alla prima
    // conferma (l'account era non confermato) applica anche il codice di registrazione, se c'è, nella stessa
    // transazione (SignupCode::applyOnConfirm). Su un account già confermato (cambio di indirizzo) non
    // riapplica nulla. Ritorna l'esito del codice di registrazione o null.
    public static function markVerified($conn, $user_id, $only_if_unverified = false)
    {
        $was = $conn->prepare("SELECT email_verified_at IS NULL FROM gym_users WHERE id = ? FOR UPDATE");
        $was->execute([$user_id]);
        $wasUnverified = (int)$was->fetchColumn() === 1;
        if ($only_if_unverified && !$wasUnverified) {
            return null;
        }
        $conn->prepare(
            "UPDATE gym_users SET email_verified_at = NOW(), unverified_notice_stage = 0, unverified_notice_at = NULL WHERE id = ?"
        )->execute([$user_id]);
        return $wasUnverified ? SignupCode::applyOnConfirm($conn, $user_id) : null;
    }

    // Registrazione: crea il primo codice e lo ritorna in chiaro (null se l'utente non c'è più).
    // Non applica i limiti di reinvio, ma l'invio conta per quelli successivi.
    public function issueForRegistration($user_id)
    {
        $this->beginReadCommitted();
        try {
            $user = $this->lockUser($user_id);
            if (!$user) {
                $this->conn->rollBack();
                return null;
            }
            $code = $this->insertCode($user_id, $this->targetOf($user));
            $this->conn->commit();
            return $code;
        } catch (Exception $e) {
            $this->abort();
            throw $e;
        }
    }

    // Reinvio al nuovo indirizzo in attesa, o a quello dell'account se non è confermato.
    // Ritorna ['status' => 'sent', 'code', 'email', 'is_change' (l'indirizzo è quello in attesa), 'username', 'locale'], ['status' => 'wait', 'seconds'],
    // ['status' => 'already_verified'] o ['status' => 'gone'].
    public function resend($user_id)
    {
        $this->beginReadCommitted();
        try {
            $user = $this->lockUser($user_id);
            if (!$user) {
                $this->conn->rollBack();
                return array('status' => 'gone');
            }
            if ($user['email_verified_at'] !== null && $user['pending_email'] === null) {
                $this->conn->rollBack();
                return array('status' => 'already_verified');
            }
            $wait = $this->resendWait($user_id);
            if ($wait > 0) {
                $this->conn->rollBack();
                return array('status' => 'wait', 'seconds' => $wait);
            }
            $target = $this->targetOf($user);
            $code = $this->insertCode($user_id, $target);
            $this->conn->commit();
            return array('status' => 'sent', 'code' => $code, 'email' => $target, 'is_change' => $user['pending_email'] !== null,
                'username' => $user['username'], 'locale' => $user['locale']);
        } catch (Exception $e) {
            $this->abort();
            throw $e;
        }
    }

    // Scrive il codice. Ritorna:
    //  ['status' => 'confirmed', 'changed' => bool, 'signup_code' (esito del codice di registrazione o null), 'old_email', 'new_email', 'username', 'locale']
    //  ['status' => 'wrong', 'attempts_left' => n]   (n = 0: il codice non vale più)
    //  ['status' => 'expired']                       (scaduto, esaurito, annullato o mai chiesto)
    //  ['status' => 'email_taken']                   (l'indirizzo in attesa è stato preso: il cambio si annulla)
    //  ['status' => 'already_verified'] o ['status' => 'gone']
    // Il tentativo sbagliato resta scritto (si fa commit, non rollback).
    public function confirm($user_id, $code)
    {
        $this->beginReadCommitted();
        try {
            $user = $this->lockUser($user_id);
            if (!$user) {
                $this->conn->rollBack();
                return array('status' => 'gone');
            }
            if ($user['email_verified_at'] !== null && $user['pending_email'] === null) {
                $this->conn->rollBack();
                return array('status' => 'already_verified');
            }
            $target = $this->targetOf($user);

            $stmt = $this->conn->prepare(
                "SELECT id, email, code_hash, attempts, UNIX_TIMESTAMP(expires_at) AS expires_ts, UNIX_TIMESTAMP() AS now_ts
                 FROM " . $this->table_name . " WHERE user_id = ? AND used_at IS NULL
                 ORDER BY id DESC LIMIT 1 FOR UPDATE"
            );
            $stmt->execute([$user_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row
                || emailCodeState($row['attempts'], (int)$row['expires_ts'], null, (int)$row['now_ts']) !== 'active'
                || $row['email'] !== $target) {
                $this->conn->rollBack();
                return array('status' => 'expired');
            }

            if (!hash_equals($row['code_hash'], emailCodeHash($user_id, $code))) {
                $attempts = (int)$row['attempts'] + 1;
                $upd = $this->conn->prepare("UPDATE " . $this->table_name . " SET attempts = ? WHERE id = ?");
                $upd->execute([$attempts, $row['id']]);
                $this->conn->commit();
                return array('status' => 'wrong', 'attempts_left' => max(0, EMAIL_CODE_MAX_ATTEMPTS - $attempts));
            }

            $this->conn->prepare("UPDATE " . $this->table_name . " SET used_at = NOW() WHERE id = ?")->execute([$row['id']]);

            $changed = $user['pending_email'] !== null;
            if ($changed) {
                // L'unicità si controlla di nuovo: nel frattempo qualcuno può aver preso l'indirizzo
                $taken = $this->emailTakenByOther($user['pending_email'], $user_id);
                if (!$taken) {
                    $taken = !$this->execUnique("UPDATE gym_users SET email = ?, pending_email = NULL, updated_at = NOW() WHERE id = ?",
                        [$user['pending_email'], $user_id]);
                }
                if ($taken) {
                    $this->conn->prepare("UPDATE gym_users SET pending_email = NULL, updated_at = NOW() WHERE id = ?")->execute([$user_id]);
                    $this->conn->commit();
                    return array('status' => 'email_taken');
                }
            }
            $signup = self::markVerified($this->conn, $user_id);
            $this->conn->commit();
            return array('status' => 'confirmed', 'changed' => $changed, 'signup_code' => $signup, 'old_email' => $user['email'],
                'new_email' => $changed ? $user['pending_email'] : $user['email'],
                'username' => $user['username'], 'locale' => $user['locale']);
        } catch (Exception $e) {
            $this->abort();
            throw $e;
        }
    }

    // Cambio di indirizzo (la password l'ha già controllata l'endpoint). Account non confermato: cambia
    // subito e i 7 giorni non ripartono; confermato: il nuovo indirizzo resta in pending_email finché non si
    // scrive il codice. In ogni caso parte un codice al nuovo indirizzo, che conta nei limiti di invio:
    // oltre il limite non cambia nulla. Ritorna ['status' => 'sent', 'mode' => 'immediate'|'pending', 'code',
    // 'email', 'username', 'locale'], 'same', 'taken', ['status' => 'wait', 'seconds'] o 'gone'.
    public function requestChange($user_id, $new_email)
    {
        $this->beginReadCommitted();
        try {
            $user = $this->lockUser($user_id);
            if (!$user) {
                $this->conn->rollBack();
                return array('status' => 'gone');
            }
            if ($new_email === $user['email']) {
                $this->conn->rollBack();
                return array('status' => 'same');
            }
            if ($this->emailTakenByOther($new_email, $user_id)) {
                $this->conn->rollBack();
                return array('status' => 'taken');
            }
            $wait = $this->resendWait($user_id);
            if ($wait > 0) {
                $this->conn->rollBack();
                return array('status' => 'wait', 'seconds' => $wait);
            }

            $immediate = $user['email_verified_at'] === null;
            $saved = $immediate
                ? $this->execUnique("UPDATE gym_users SET email = ?, pending_email = NULL, updated_at = NOW() WHERE id = ?", [$new_email, $user_id])
                : $this->execUnique("UPDATE gym_users SET pending_email = ?, updated_at = NOW() WHERE id = ?", [$new_email, $user_id]);
            if (!$saved) {
                $this->conn->rollBack();
                return array('status' => 'taken');
            }
            $code = $this->insertCode($user_id, $new_email);
            $this->conn->commit();
            return array('status' => 'sent', 'mode' => $immediate ? 'immediate' : 'pending', 'code' => $code,
                'email' => $new_email, 'username' => $user['username'], 'locale' => $user['locale']);
        } catch (Exception $e) {
            $this->abort();
            throw $e;
        }
    }

    // Annulla il cambio in attesa (e i codici mandati al nuovo indirizzo). Idempotente: true se c'era.
    public function cancelChange($user_id)
    {
        $this->beginReadCommitted();
        try {
            $user = $this->lockUser($user_id);
            if (!$user || $user['pending_email'] === null) {
                $this->conn->rollBack();
                return false;
            }
            $this->conn->prepare("UPDATE gym_users SET pending_email = NULL, updated_at = NOW() WHERE id = ?")->execute([$user_id]);
            $this->invalidateForUser($user_id);
            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            $this->abort();
            throw $e;
        }
    }

    // Indirizzo a cui va il codice: quello in attesa, altrimenti quello dell'account
    private function targetOf($user)
    {
        return $user['pending_email'] !== null ? $user['pending_email'] : $user['email'];
    }

    // Secondi da aspettare prima di un altro invio (0 = si può): tutti i codici mandati all'utente
    // nell'ultima ora, anche annullati e di altri indirizzi. Orologio del database, come created_at.
    private function resendWait($user_id)
    {
        $stmt = $this->conn->prepare(
            "SELECT UNIX_TIMESTAMP(created_at) AS ts, UNIX_TIMESTAMP() AS now_ts FROM " . $this->table_name . "
             WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        );
        $stmt->execute([$user_id]);
        $sent = array();
        $now = (int)time();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $sent[] = (int)$r['ts'];
            $now = (int)$r['now_ts'];
        }
        if (!$sent) {
            return 0;
        }
        return emailCodeResendWait($sent, $now);
    }

    // Crea il codice (annullando i precedenti) e lo ritorna in chiaro
    private function insertCode($user_id, $email)
    {
        $this->invalidateForUser($user_id);
        $code = emailCodeGenerate();
        $this->conn->prepare(
            "INSERT INTO " . $this->table_name . " (user_id, email, code_hash, expires_at)
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL " . (int)EMAIL_CODE_TTL_SECONDS . " SECOND))"
        )->execute([$user_id, $email, emailCodeHash($user_id, $code)]);
        return $code;
    }

    private function invalidateForUser($user_id)
    {
        $this->conn->prepare("UPDATE " . $this->table_name . " SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL")
            ->execute([$user_id]);
    }

    // Esegue un UPDATE che può scontrarsi con l'unicità dell'email: false se l'indirizzo è stato preso nel frattempo
    // (SQLSTATE 23000), true se riuscito; ogni altro errore risale.
    private function execUnique($sql, array $params)
    {
        try {
            $this->conn->prepare($sql)->execute($params);
            return true;
        } catch (PDOException $e) {
            if (($e->errorInfo[0] ?? $e->getCode()) !== '23000') {
                throw $e;
            }
            return false;
        }
    }

    private function emailTakenByOther($email, $user_id)
    {
        $stmt = $this->conn->prepare("SELECT id FROM gym_users WHERE email = ? AND id <> ? LIMIT 1");
        $stmt->execute([$email, $user_id]);
        return $stmt->fetchColumn() !== false;
    }

    // Come PasswordReset: READ COMMITTED evita blocchi d'intervallo tra account diversi
    private function beginReadCommitted()
    {
        $this->conn->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        $this->conn->beginTransaction();
    }

    // Blocca la riga dell'utente fino alla fine della transazione e la ritorna (false se non esiste più)
    private function lockUser($user_id)
    {
        $stmt = $this->conn->prepare(
            "SELECT id, username, email, email_verified_at, pending_email, locale FROM gym_users WHERE id = ? FOR UPDATE"
        );
        $stmt->execute([$user_id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function abort()
    {
        if ($this->conn->inTransaction()) {
            $this->conn->rollBack();
        }
    }
}
