<?php
// Regole pure dei codici di registrazione (nessun database): normalizzazione, posti occupati, uso in
// registrazione, esito alla conferma dell'email e livello dato. Gli istanti sono unix timestamp (UTC) o
// stringhe UTC 'Y-m-d H:i:s' (come tier_until). Provate da tests/signup_code_rules_test.php.
// Richiede lib/tier_rules.php e lib/email_verification_rules.php.
require_once __DIR__ . '/tier_rules.php';
require_once __DIR__ . '/email_verification_rules.php';

const SIGNUP_CODE_MIN_LENGTH = 4;
const SIGNUP_CODE_MAX_LENGTH = 40;
// Senza 0, O, 1, I: il codice generato si legge e si detta senza equivoci
const SIGNUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SIGNUP_CODE_GENERATED_LENGTH = 10;
// Tetto della durata del livello: ben dentro i limiti di tierSetUntil (anno 9999)
const SIGNUP_CODE_MAX_DURATION_DAYS = 3650;
const SIGNUP_TIERS = ['plus', 'pro'];

// Testo normalizzato del codice (spazi ai bordi via, maiuscole), o null se non è un codice ammesso:
// lettere A-Z, cifre e trattino, da 4 a 40 caratteri. "mario-plus", " Mario-Plus " e "MARIO-PLUS" sono lo stesso.
function signupCodeNormalize($raw): ?string
{
    if (!is_string($raw)) {
        return null;
    }
    $code = strtoupper(trim($raw));
    $len = strlen($code);
    if ($len < SIGNUP_CODE_MIN_LENGTH || $len > SIGNUP_CODE_MAX_LENGTH || preg_match('/^[A-Z0-9-]+$/', $code) !== 1) {
        return null;
    }
    return $code;
}

// Codice generato dal server: 10 caratteri leggibili
function signupCodeGenerate(): string
{
    $out = '';
    $max = strlen(SIGNUP_CODE_ALPHABET) - 1;
    for ($i = 0; $i < SIGNUP_CODE_GENERATED_LENGTH; $i++) {
        $out .= SIGNUP_CODE_ALPHABET[random_int(0, $max)];
    }
    return $out;
}

// Posti occupati di un codice. $uses: un elemento per uso, ['status' => 'pending'|'applied'|'missed',
// 'user_exists' => bool, 'user_created_ts' => timestamp di registrazione dell'utente o null].
// Occupano: gli usi 'applied' (anche se l'account è stato eliminato) e quelli 'pending' con l'utente ancora
// esistente e registrato da meno di 7 × 24 ore (la finestra della conferma). 'missed' non occupa.
function signupCodeSeatsTaken(array $uses, int $now): int
{
    $taken = 0;
    foreach ($uses as $u) {
        if ($u['status'] === 'applied') {
            $taken++;
        } elseif ($u['status'] === 'pending' && $u['user_exists'] && $u['user_created_ts'] !== null
            && $now < emailVerificationDeadline((int)$u['user_created_ts'])) {
            $taken++;
        }
    }
    return $taken;
}

// Un codice è scaduto da $expires_at (UTC 'Y-m-d H:i:s', NULL = mai) in poi
function signupCodeIsExpired(?string $expires_at, string $nowUtc): bool
{
    return $expires_at !== null && $nowUtc >= $expires_at;
}

// Si può usare in registrazione? $code: riga del codice (enabled, max_uses, expires_at) o null se non esiste.
// Ritorna 'ok', 'invalid' (inesistente o spento: stesso esito), 'expired' o 'exhausted'.
function signupCodeRegistrationCheck(?array $code, int $seatsTaken, string $nowUtc): string
{
    if ($code === null || (int)$code['enabled'] !== 1) {
        return 'invalid';
    }
    if (signupCodeIsExpired($code['expires_at'], $nowUtc)) {
        return 'expired';
    }
    if ($seatsTaken >= (int)$code['max_uses']) {
        return 'exhausted';
    }
    return 'ok';
}

// Esito alla conferma dell'email di un uso 'pending': 'applied' o 'missed' (resta Gratis).
// Entro i 7 giorni dalla registrazione il posto è garantito: conta solo che il codice sia ancora acceso.
// Dopo servono codice acceso, non scaduto e un posto libero ($seatsTaken esclude questo uso, che dopo i 7
// giorni non occupa più nulla). $now è il timestamp della conferma.
function signupCodeConfirmOutcome(?array $code, int $seatsTaken, int $userCreatedTs, int $now): string
{
    if ($code === null || (int)$code['enabled'] !== 1) {
        return 'missed';
    }
    if ($now < emailVerificationDeadline($userCreatedTs)) {
        return 'applied';
    }
    $nowUtc = gmdate('Y-m-d H:i:s', $now);
    if (signupCodeIsExpired($code['expires_at'], $nowUtc) || $seatsTaken >= (int)$code['max_uses']) {
        return 'missed';
    }
    return 'applied';
}

// Ultimo giorno valido del livello (AAAA-MM-GG, ora italiana): il giorno italiano di $now + $durationDays.
// È quello che tierSetUntil prende e converte nell'istante di scadenza.
function signupCodeLastDay(int $durationDays, int $now): string
{
    return (new DateTimeImmutable('@' . $now))->setTimezone(new DateTimeZone(TIER_TIME_ZONE))
        ->modify('+' . $durationDays . ' days')->format('Y-m-d');
}

// Livello da scrivere nell'account alla conferma. $curTier/$curUntil: quello salvato (tier, tier_until).
// Ritorna ['changed' => bool, 'tier', 'until' (UTC 'Y-m-d H:i:s' o null)]: con changed false l'account
// resta com'è (e l'uso risulta comunque applicato). Regola unica di dominanza: il livello del codice si
// assegna solo se è uguale o superiore a quello in vigore E la sua scadenza è uguale o più lontana (senza
// scadenza = infinito) E non è identico a quello che c'è già. Un account Gratis (o con livello scaduto)
// riceve sempre il livello del codice.
function signupCodeTierOutcome(string $codeTier, ?int $durationDays, string $curTier, ?string $curUntil, int $now): array
{
    $nowUtc = gmdate('Y-m-d H:i:s', $now);
    $effective = tierEffective($curTier, $curUntil, $nowUtc);

    $until = null;
    if ($durationDays !== null) {
        $r = tierSetUntil($codeTier, signupCodeLastDay($durationDays, $now), $nowUtc);
        if (isset($r['error'])) {
            throw new RuntimeException('Durata del codice non applicabile: ' . $r['error']);
        }
        $until = $r['until'];
    }

    if ($effective !== 'free') {
        // dominanza: il codice si applica solo se non peggiora l'account (livello e scadenza)
        $curRank = array_search($effective, TIER_LEVELS, true);
        $codeRank = array_search($codeTier, TIER_LEVELS, true);
        $codeDominates = $codeRank >= $curRank && ($curUntil === null ? $until === null : ($until === null || $until >= $curUntil));
        $identical = $effective === $codeTier && $curUntil === $until;
        if (!$codeDominates || $identical) {
            return array('changed' => false, 'tier' => $curTier, 'until' => $curUntil);
        }
    }
    return array('changed' => true, 'tier' => $codeTier, 'until' => $until);
}
