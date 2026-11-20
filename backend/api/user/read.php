<?php
// GET: profilo dell'utente. signup_code = l'uso del codice di registrazione (null senza) {status, tier,
// duration_days}: tier e duration_days sono quelli del CODICE (servono per «Plus in attesa» finché è pending),
// non quelli dell'account; l'account è in tier, tier_until e tier_last_day. In confirm_email.php, invece, con
// applied signup_code.tier e tier_last_day descrivono l'account dopo la conferma.
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';
include_once '../../models/SignupCode.php';
require_once '../../lib/weekly_stats.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception("Impossibile stabilire una connessione al database.");
    }

    $user = new User($db);

    // Risponde 200 anche all'account bloccato dal giorno 8: è il modo in cui il client sa di dover chiedere il codice
    $user_id = require_authenticated_user($db, ALLOW_UNVERIFIED);

    if ($user->readById($user_id)) {
        $verification = user_email_verification($db, $user_id);
        $tierDates = SignupCode::tierDates($db, $user_id);
        echo json_encode(array(
            'success' => true,
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'email_verified' => $verification['verified'],
            'email_verification' => $verification['status'],
            'pending_email' => $verification['pending_email'],
            'created_at' => server_time_iso($user->created_at),
            'rest_timer_enabled' => $user->rest_timer_enabled,
            'age' => $user->age,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'training_start_date' => $user->training_start_date,
            'locale' => $user->locale,
            'weight_unit' => $user->weight_unit,
            // Moduli facoltativi {body, recovery, levels, groups, ai}: «non attivo» è solo visualizzazione
            'modules' => $user->modules,
            'modules_chosen' => $user->modules_chosen,
            // Visibilità nei gruppi {workouts, volume, streak, level}: i valori salvati, non quelli effettivi
            'group_visibility' => $user->group_visibility,
            'experience_years' => $user->experience_years,
            'password_changed_at' => server_time_iso($user->password_changed_at),
            'is_admin' => user_is_admin($db, $user_id),
            'tier' => user_tier($db, $user_id),
            // Quando finisce il livello: istante UTC e ultimo giorno valido in ora italiana (null se free o senza scadenza)
            'tier_until' => $tierDates['tier_until'],
            'tier_last_day' => $tierDates['tier_last_day'],
            // Codice di registrazione dell'account: null o {status: pending|applied|missed, tier, duration_days}
            'signup_code' => SignupCode::useOf($db, $user_id),
            'limits' => user_limits($db, $user_id),
            'features' => user_features($db, $user_id)
        ) + weekly_goal_settings($db, $user_id));
    } else {
        http_response_code(404);
        echo json_encode(array('success' => false, 'message' => t_server('common.user_not_found')));
    }
} catch (Exception $e) {
    error_log("Read User Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array(
        'success' => false,
        'message' => t_server('common.server_error')
    ));
}
