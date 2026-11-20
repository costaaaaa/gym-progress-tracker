<?php
include_once '../../config/cors_headers.php';

// Include database e modelli
include_once '../../config/database.php';
include_once '../../config/api_helpers.php';
include_once '../../models/User.php';
require_once '../../lib/workout_gamification.php';

$database = new Database();
$db = $database->getConnection();

$user_id = require_authenticated_user($db);

// Solo richieste POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => t_server('common.method_not_allowed')]);
    exit;
}

try {
    // Recupera i dati inviati
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || !is_object($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('common.missing_data')]);
        exit;
    }

    // Aggiornamento parziale: si modificano solo i campi presenti nella richiesta.
    $fields = [];
    if (isset($data->rest_timer_enabled)) {
        $fields['rest_timer_enabled'] = (bool)$data->rest_timer_enabled;
    }
    // Data di nascita e sesso non si possono svuotare: se presenti devono essere validi.
    if (property_exists($data, 'birth_date')) {
        $error = birth_date_error($data->birth_date);
        if ($error !== null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $error]);
            exit;
        }
        $fields['birth_date'] = $data->birth_date;
    }
    if (property_exists($data, 'gender')) {
        if (!valid_gender($data->gender)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('register.gender_required')]);
            exit;
        }
        $fields['gender'] = $data->gender;
    }
    if (property_exists($data, 'training_start_date')) {
        $tsd = $data->training_start_date;
        $error = training_start_date_error($tsd);
        if ($error !== null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $error]);
            exit;
        }
        $fields['training_start_date'] = ($tsd === null || $tsd === '') ? null : $tsd;
    }
    if (property_exists($data, 'locale')) {
        if (!is_string($data->locale) || !in_array($data->locale, SUPPORTED_LOCALES, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.locale_invalid')]);
            exit;
        }
        $fields['locale'] = $data->locale;
    }
    if (property_exists($data, 'weight_unit')) {
        if (!valid_weight_unit($data->weight_unit)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.weight_unit_invalid')]);
            exit;
        }
        $fields['weight_unit'] = $data->weight_unit;
    }
    // Moduli: oggetto parziale {chiave: booleano}, cambiano solo le chiavi presenti; chiave sconosciuta o valore
    // non booleano = 400 e nessuna modifica
    if (property_exists($data, 'modules')) {
        $modules = $data->modules;
        if (!is_object($modules)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.modules_invalid')]);
            exit;
        }
        foreach ($modules as $key => $value) {
            if (!in_array((string)$key, User::MODULES, true) || !is_bool($value)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => t_server('settings.modules_invalid')]);
                exit;
            }
            $fields['module_' . $key] = $value;
        }
    }
    // Visibilità nei gruppi: oggetto parziale {chiave: booleano}, come i moduli
    if (property_exists($data, 'group_visibility')) {
        $visibility = $data->group_visibility;
        if (!is_object($visibility)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.group_visibility_invalid')]);
            exit;
        }
        foreach ($visibility as $key => $value) {
            if (!in_array((string)$key, User::GROUP_VISIBILITY, true) || !is_bool($value)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => t_server('settings.group_visibility_invalid')]);
                exit;
            }
            $fields['group_show_' . $key] = $value;
        }
    }
    // Chiusura della scelta dei moduli: solo `true` (una volta sola; la data si scrive se è ancora vuota)
    if (property_exists($data, 'modules_chosen')) {
        if ($data->modules_chosen !== true) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.modules_invalid')]);
            exit;
        }
        $fields['modules_chosen'] = true;
    }
    // Layout della Home: null = torna al predefinito, altrimenti elenco di {key, hidden, large} (vedi home_layout_valid)
    if (property_exists($data, 'home_layout')) {
        $layout = $data->home_layout === null ? null : home_layout_valid($data->home_layout);
        if ($layout === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.home_layout_invalid')]);
            exit;
        }
        $fields['home_layout'] = $layout;
    }
    // Risposta alla proposta di un modulo: {key, accepted}
    if (property_exists($data, 'module_offer_answer')) {
        $answer = $data->module_offer_answer;
        if (!is_object($answer) || !isset($answer->key) || !is_string($answer->key) || !in_array($answer->key, User::MODULE_OFFERS, true)
            || !isset($answer->accepted) || !is_bool($answer->accepted)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => t_server('settings.module_offer_invalid')]);
            exit;
        }
        $fields['module_offer_answer'] = ['key' => $answer->key, 'accepted' => $answer->accepted];
    }
    // Obiettivo settimanale: da 1 a 7 allenamenti, null = torna al default (giorni della scheda attiva)
    $weekly_goal_given = property_exists($data, 'weekly_goal');
    if ($weekly_goal_given) {
        $wg = $data->weekly_goal;
        if ($wg !== null && !(is_int($wg) && $wg >= 1 && $wg <= 7)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'code' => 'weekly_goal_invalid', 'message' => t_server('settings.weekly_goal_invalid')]);
            exit;
        }
    }
    if (empty($fields) && !$weekly_goal_given) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => t_server('settings.no_fields')]);
        exit;
    }

    // Crea un'istanza del modello User
    $user = new User($db);
    $user->id = $user_id;

    $saved = empty($fields) ? $user->readById($user_id) : $user->updateProfile($fields);
    if ($saved && $weekly_goal_given) {
        $db->beginTransaction();
        try {
            apply_weekly_goal_change($db, $user_id, $data->weekly_goal, user_now());
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    if ($saved) {
        request_locale(true);
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => t_server('settings.updated'),
            'rest_timer_enabled' => $user->rest_timer_enabled,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'training_start_date' => $user->training_start_date,
            'locale' => $user->locale,
            'weight_unit' => $user->weight_unit,
            'modules' => $user->modules,
            'modules_chosen' => $user->modules_chosen,
            'group_visibility' => $user->group_visibility,
            'home_layout' => $user->home_layout,
            'module_offer' => $user->module_offer,
            'age' => $user->age,
            'experience_years' => $user->experience_years
        ] + weekly_goal_settings($db, $user_id));
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => t_server('settings.update_error')
        ]);
    }
} catch (Exception $e) {
    error_log("Error in update_settings.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => t_server('settings.update_error')
    ]);
}
