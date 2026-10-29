<?php
// Orari mandati dal client (start_time, ended_at): client_datetime() li porta nel fuso del server (o in
// quello dato) prima che qualcuno li formatti per il database. Qui anche gli helper dei fusi (#55):
// validazione IANA, fuso della richiesta, istante e forma ISO di un allenamento.
// Si lancia con tests/client_time.sh. Esce con 1 se un controllo fallisce.

require __DIR__ . '/../backend/config/api_helpers.php';

$fails = 0;
$checks = 0;
function check($desc, $cond)
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

date_default_timezone_set('Europe/Rome');

check('UTC in ora legale: +2 ore', client_datetime('2026-10-24T16:00:00.000Z')->format('Y-m-d H:i:s') === '2026-10-24 18:00:00');
check('UTC in ora solare: +1 ora', client_datetime('2026-10-28T16:00:00.000Z')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('dopo le 22 UTC finisce sul giorno dopo', client_datetime('2026-10-28T23:30:00.000Z')->format('Y-m-d H:i:s') === '2026-10-29 00:30:00');
check('cambio d\'ora di ottobre: 00:30 UTC del 25 è 02:30 ora legale', client_datetime('2026-10-25T00:30:00Z')->format('Y-m-d H:i:s') === '2026-10-25 02:30:00');
check('cambio d\'ora di ottobre: 01:30 UTC del 25 è 02:30 ora solare', client_datetime('2026-10-25T01:30:00Z')->format('Y-m-d H:i:s') === '2026-10-25 02:30:00');
check('offset esplicito diverso da UTC: stesso istante, ora del server', client_datetime('2026-10-28T11:00:00-05:00')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('senza fuso: preso già nel fuso del server', client_datetime('2026-10-28 17:00:00')->format('Y-m-d H:i:s') === '2026-10-28 17:00:00');
check('l\'istante non cambia (timestamp)', client_datetime('2026-10-28T16:00:00.000Z')->getTimestamp() === (new DateTime('2026-10-28T16:00:00Z'))->getTimestamp());
check('il fuso del risultato è quello del server', client_datetime('2026-10-28T16:00:00.000Z')->getTimezone()->getName() === 'Europe/Rome');
check('è un istante immutabile', client_datetime('2026-10-28T16:00:00.000Z') instanceof DateTimeImmutable);
check('stringa non valida: eccezione', (function () { try { client_datetime('non-una-data'); return false; } catch (Exception $e) { return true; } })());


echo "\nclient_datetime con un fuso dato\n";
check('UTC → New York in ora legale (-4)', client_datetime('2026-10-24T16:00:00.000Z', 'America/New_York')->format('Y-m-d H:i:s') === '2026-10-24 12:00:00');
check('UTC → Tokyo (+9)', client_datetime('2026-10-24T16:00:00Z', 'Asia/Tokyo')->format('Y-m-d H:i:s') === '2026-10-25 01:00:00');
check('senza fuso nella stringa vale il fuso dato', client_datetime('2026-10-24 21:30:00', 'America/New_York')->getTimestamp() === (new DateTime('2026-10-25T01:30:00Z'))->getTimestamp());
check('il fuso del risultato è quello dato', client_datetime('2026-10-24T16:00:00Z', 'Asia/Tokyo')->getTimezone()->getName() === 'Asia/Tokyo');
check('passaggio all\'ora solare di New York: 05:30 UTC del 1 novembre è 01:30 EDT', client_datetime('2026-11-01T05:30:00Z', 'America/New_York')->format('c') === '2026-11-01T01:30:00-04:00');
check('passaggio all\'ora solare di New York: 06:30 UTC del 1 novembre è 01:30 EST', client_datetime('2026-11-01T06:30:00Z', 'America/New_York')->format('c') === '2026-11-01T01:30:00-05:00');
check('fuso nullo: quello del server, come prima', client_datetime('2026-10-24T16:00:00Z', null)->format('H:i') === '18:00');

echo "\nvalid_time_zone\n";
check('nome IANA valido', valid_time_zone('America/New_York') === 'America/New_York');
check('Europe/Rome valido', valid_time_zone('Europe/Rome') === 'Europe/Rome');
check('spazi attorno ignorati', valid_time_zone(' Asia/Tokyo ') === 'Asia/Tokyo');
check('offset rifiutato', valid_time_zone('+02:00') === null);
check('abbreviazione rifiutata', valid_time_zone('EST') === null);
check('nome inventato rifiutato', valid_time_zone('Mars/Olympus') === null);
check('stringa vuota rifiutata', valid_time_zone('') === null);
check('null rifiutato', valid_time_zone(null) === null);
check('non stringa rifiutato', valid_time_zone(array('Europe/Rome')) === null);
check('maiuscole/minuscole sbagliate rifiutate', valid_time_zone('europe/rome') === null);

echo "\nistante e forma ISO di un allenamento\n";
check('ora locale di New York → istante UTC', workout_instant('2026-10-25 21:00:00', 'America/New_York')->getTimestamp() === (new DateTime('2026-10-26T01:00:00Z'))->getTimestamp());
check('started_at con offset di New York', workout_started_at('2026-10-25 21:00:00', 'America/New_York') === '2026-10-25T21:00:00-04:00');
check('started_at con offset di Roma in ora solare', workout_started_at('2026-10-28 17:00:00', 'Europe/Rome') === '2026-10-28T17:00:00+01:00');
check('started_at con offset di Tokyo', workout_started_at('2026-10-28 17:00:00', 'Asia/Tokyo') === '2026-10-28T17:00:00+09:00');
check('ora che non esiste (salto in avanti) si sposta avanti', workout_started_at('2026-03-29 02:30:00', 'Europe/Rome') === '2026-03-29T03:30:00+02:00');
check('ora doppia accettata: una delle due occorrenze, senza errore', in_array(workout_started_at('2026-10-25 02:30:00', 'Europe/Rome'), array('2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00'), true));
check('fuso non valido: ripiego su Roma', workout_started_at('2026-10-28 17:00:00', 'Mars/Olympus') === '2026-10-28T17:00:00+01:00');
check('istante in ora del server: New York 21:00 → 02:00 del giorno dopo a Roma', server_time_from_instant(workout_instant('2026-10-25 21:00:00', 'America/New_York')) === '2026-10-26 02:00:00');
check('istante in ora del server: Tokyo 08:00 in ora legale → 01:00 a Roma', server_time_from_instant(workout_instant('2026-07-01 08:00:00', 'Asia/Tokyo')) === '2026-07-01 01:00:00');
check('istante in ora del server: Roma resta uguale', server_time_from_instant(workout_instant('2026-10-28 17:00:00', 'Europe/Rome')) === '2026-10-28 17:00:00');
check('istante in ora del server: accetta anche un DateTime', server_time_from_instant(new DateTime('2026-10-25 21:00:00', new DateTimeZone('America/New_York'))) === '2026-10-26 02:00:00');

echo "\ndatetime del server in ISO con offset\n";
check('ora del server → ISO con offset di Roma', server_time_iso('2026-10-28 17:00:00') === '2026-10-28T17:00:00+01:00');
check('ora legale', server_time_iso('2026-07-01 09:00:00') === '2026-07-01T09:00:00+02:00');
check('null resta null', server_time_iso(null) === null);
check('stringa vuota resta null', server_time_iso('') === null);
check('data a zero resta null', server_time_iso('0000-00-00 00:00:00') === null);

echo "\nfuso della richiesta\n";
unset($_SERVER['HTTP_X_TIMEZONE']);
request_user_context(null, null);
check('senza header né utente: Europe/Rome', request_time_zone(true) === 'Europe/Rome');
$_SERVER['HTTP_X_TIMEZONE'] = 'America/New_York';
check('header valido', request_time_zone(true) === 'America/New_York');
check('la risposta è memorizzata per la richiesta', (function () { $_SERVER['HTTP_X_TIMEZONE'] = 'Asia/Tokyo'; return request_time_zone() === 'America/New_York'; })());
$_SERVER['HTTP_X_TIMEZONE'] = 'Mars/Olympus';
check('header non valido ignorato', request_time_zone(true) === 'Europe/Rome');
$_SERVER['HTTP_X_TIMEZONE'] = '+02:00';
check('offset nell\'header ignorato', request_time_zone(true) === 'Europe/Rome');
$_SERVER['HTTP_X_TIMEZONE'] = 'America/New_York';
check('user_now è nel fuso della richiesta', request_time_zone(true) === 'America/New_York' && user_now()->getTimezone()->getName() === 'America/New_York');
check('user_now è adesso', abs(user_now()->getTimestamp() - time()) <= 2);

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE gym_users (id INTEGER PRIMARY KEY, time_zone TEXT NULL)');
$db->exec("INSERT INTO gym_users (id, time_zone) VALUES (1, NULL), (2, 'Asia/Tokyo'), (3, 'Mars/Olympus')");
$saved = function ($id) use ($db) { return $db->query("SELECT time_zone FROM gym_users WHERE id = $id")->fetchColumn(); };

echo "\norario del server nel fuso della richiesta\n";
request_user_context(null, null);
$_SERVER['HTTP_X_TIMEZONE'] = 'America/New_York';
request_time_zone(true);
check('ora del server → ora di New York', server_time_in_request_zone('2026-10-28 17:00:00')->format('Y-m-d H:i') === '2026-10-28 12:00');
check('il giorno può cambiare (Tokyo)', (function () { $_SERVER['HTTP_X_TIMEZONE'] = 'Asia/Tokyo'; request_time_zone(true); return server_time_in_request_zone('2026-10-28 17:00:00')->format('Y-m-d H:i') === '2026-10-29 01:00'; })());
unset($_SERVER['HTTP_X_TIMEZONE']);
request_time_zone(true);
check('senza fuso: Roma, com\'è nel database', server_time_in_request_zone('2026-10-28 17:00:00')->format('Y-m-d H:i') === '2026-10-28 17:00');

echo "\nfuso della richiesta con un utente (getter: non scrive)\n";
unset($_SERVER['HTTP_X_TIMEZONE']);
request_user_context($db, 2);
check('senza header: quello salvato sull\'utente', request_time_zone(true) === 'Asia/Tokyo');
request_user_context($db, 1);
check('senza header né fuso salvato: Europe/Rome', request_time_zone(true) === 'Europe/Rome');
request_user_context($db, 3);
check('fuso salvato non valido ignorato', request_time_zone(true) === 'Europe/Rome');
request_user_context($db, 2);
$_SERVER['HTTP_X_TIMEZONE'] = 'America/New_York';
check('header valido batte quello salvato', request_time_zone(true) === 'America/New_York');
check('leggerlo non aggiorna gym_users.time_zone', $saved(2) === 'Asia/Tokyo');

echo "\nfuso salvato su ogni richiesta autenticata\n";
$_SERVER['HTTP_X_TIMEZONE'] = 'America/New_York';
remember_request_time_zone($db, 2);
check('l\'header diverso aggiorna gym_users.time_zone', $saved(2) === 'America/New_York');
remember_request_time_zone($db, 1);
check('primo fuso dell\'utente salvato dall\'header', $saved(1) === 'America/New_York');
remember_request_time_zone($db, 3);
check('fuso salvato non valido sostituito', $saved(3) === 'America/New_York');
$_SERVER['HTTP_X_TIMEZONE'] = 'Mars/Olympus';
remember_request_time_zone($db, 2);
check('header non valido: non tocca il fuso salvato', $saved(2) === 'America/New_York');
$_SERVER['HTTP_X_TIMEZONE'] = '+02:00';
remember_request_time_zone($db, 2);
check('offset nell\'header: non tocca il fuso salvato', $saved(2) === 'America/New_York');
unset($_SERVER['HTTP_X_TIMEZONE']);
remember_request_time_zone($db, 2);
check('senza header: non tocca il fuso salvato', $saved(2) === 'America/New_York');
$_SERVER['HTTP_X_TIMEZONE'] = 'Asia/Tokyo';
remember_request_time_zone($db, 2);
check('un nuovo fuso valido lo sostituisce', $saved(2) === 'Asia/Tokyo');

echo "\nerrori del database: solo la colonna mancante è silenziosa\n";
$missing = new PDOException('Unknown column');
$missing->errorInfo = array('42S22', 1054, 'Unknown column \'time_zone\' in \'field list\'');
$other = new PDOException('MySQL server has gone away');
$other->errorInfo = array('HY000', 2006, 'MySQL server has gone away');
check('42S22 è colonna mancante', is_missing_column_error($missing));
check('HY000 non lo è', !is_missing_column_error($other));
check('senza errorInfo conta il codice dell\'eccezione', !is_missing_column_error(new PDOException('x')));

class FailingDb
{
    public function __construct(private PDOException $error) {}
    public function prepare($sql) { throw $this->error; }
}
$log_file = tempnam(sys_get_temp_dir(), 'tzlog');
ini_set('error_log', $log_file);
$logged = function () use ($log_file) { return (string)file_get_contents($log_file); };

$_SERVER['HTTP_X_TIMEZONE'] = 'Asia/Tokyo';
request_user_context(new FailingDb($missing), 1);
remember_request_time_zone(request_user_context()['db'], 1);
check('colonna non migrata: salvataggio silenzioso, nessun errore', $logged() === '');
unset($_SERVER['HTTP_X_TIMEZONE']);
check('colonna non migrata e niente header: Europe/Rome, silenzioso', request_time_zone(true) === 'Europe/Rome' && $logged() === '');
$_SERVER['HTTP_X_TIMEZONE'] = 'Asia/Tokyo';
check('colonna non migrata: l\'header vale lo stesso', request_time_zone(true) === 'Asia/Tokyo');

request_user_context(new FailingDb($other), 1);
remember_request_time_zone(request_user_context()['db'], 1);
check('altro errore nel salvataggio: registrato, la richiesta prosegue', strpos($logged(), 'remember_request_time_zone: MySQL server has gone away') !== false);
unset($_SERVER['HTTP_X_TIMEZONE']);
check('altro errore nella lettura: registrato, ripiego su Europe/Rome', request_time_zone(true) === 'Europe/Rome' && strpos($logged(), 'request_time_zone: MySQL server has gone away') !== false);
unlink($log_file);

echo "\nspostare un allenamento su un altro giorno (moved_workout_instant)\n";
$at = function ($new_date, $time_of_day, $zone, $now = '2026-12-01T12:00:00Z') {
    return moved_workout_instant($new_date, $time_of_day, $zone, new DateTimeImmutable($now))->format('c');
};
check('è un istante immutabile', moved_workout_instant('2026-10-20', '12:00:00', 'Europe/Rome', new DateTimeImmutable('2026-12-01T12:00:00Z')) instanceof DateTimeImmutable);
check('Roma, fine ora legale (25/10/2026): verso la solare, l\'orario locale resta e cambia l\'offset', $at('2026-10-26', '12:00:00', 'Europe/Rome') === '2026-10-26T12:00:00+01:00');
check('Roma, fine ora legale: verso l\'ora legale', $at('2026-10-24', '12:00:00', 'Europe/Rome') === '2026-10-24T12:00:00+02:00');
check('Roma, inizio ora legale (29/03/2026): verso l\'ora legale', $at('2026-03-30', '12:00:00', 'Europe/Rome') === '2026-03-30T12:00:00+02:00');
check('Roma, inizio ora legale: verso la solare', $at('2026-03-28', '12:00:00', 'Europe/Rome') === '2026-03-28T12:00:00+01:00');
check('New York, fine ora legale (01/11/2026): verso la solare', $at('2026-11-02', '07:15:00', 'America/New_York') === '2026-11-02T07:15:00-05:00');
check('New York, fine ora legale: verso l\'ora legale', $at('2026-10-31', '07:15:00', 'America/New_York') === '2026-10-31T07:15:00-04:00');
check('ora che non esiste (02:30 del 29/03/2026 a Roma): PHP la sposta avanti alle 03:30', $at('2026-03-29', '02:30:00', 'Europe/Rome') === '2026-03-29T03:30:00+02:00');
// Ora doppia: PHP sceglie una delle due occorrenze e non sempre la stessa fra fusi (PHP 8.5: a Roma
// la seconda, +01:00; a New York la prima, -04:00). Conta che l'orario locale resti quello e che non
// ci sia errore: il test accetta entrambe.
check('ora doppia (02:30 del 25/10/2026 a Roma): orario locale intatto, una delle due occorrenze', in_array($at('2026-10-25', '02:30:00', 'Europe/Rome'), array('2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00'), true));
check('ora doppia (01:30 del 01/11/2026 a New York): orario locale intatto, una delle due occorrenze', in_array($at('2026-11-01', '01:30:00', 'America/New_York'), array('2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00'), true));
check('ora che non esiste (02:30 dell\'08/03/2026 a New York): spostata avanti alle 03:30', $at('2026-03-08', '02:30:00', 'America/New_York') === '2026-03-08T03:30:00-04:00');

$now = '2026-10-26T10:00:00Z';   // 11:00 a Roma, 06:00 a New York
check('orario originale non ancora arrivato oggi: vale l\'ora attuale del luogo (Roma)', $at('2026-10-26', '12:00:00', 'Europe/Rome', $now) === '2026-10-26T11:00:00+01:00');
check('stessa regola a New York', $at('2026-10-26', '07:15:00', 'America/New_York', $now) === '2026-10-26T06:00:00-04:00');
check('orario originale già passato oggi: resta', $at('2026-10-26', '10:30:00', 'Europe/Rome', $now) === '2026-10-26T10:30:00+01:00');
check('orario originale uguale a adesso: resta', $at('2026-10-26', '11:00:00', 'Europe/Rome', $now) === '2026-10-26T11:00:00+01:00');
check('giorno futuro: resta nel futuro, lo rifiuta chi chiama', moved_workout_instant('2026-10-27', '12:00:00', 'Europe/Rome', new DateTimeImmutable($now)) > new DateTimeImmutable($now));
check('data e ora complete: valgono così, l\'orario originale non conta', $at('2026-10-24 18:20:00', '12:00:00', 'Europe/Rome') === '2026-10-24T18:20:00+02:00');
check('data e ora con offset: stesso istante, ora del luogo', $at('2026-10-25T00:30:00Z', '12:00:00', 'Europe/Rome') === '2026-10-25T02:30:00+02:00');
check('fuso non valido: Europe/Rome', $at('2026-10-26', '12:00:00', 'Mars/Olympus') === '2026-10-26T12:00:00+01:00');
check('data non valida: eccezione', (function () { try { moved_workout_instant('non-una-data', '12:00:00', 'Europe/Rome', new DateTimeImmutable()); return false; } catch (Exception $e) { return true; } })());

echo "\n" . ($checks - $fails) . "/$checks controlli riusciti\n";
exit($fails > 0 ? 1 : 0);
