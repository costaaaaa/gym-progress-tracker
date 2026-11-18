<?php
include_once '../../config/cors_headers.php';

include_once '../../config/database.php';
include_once '../../config/rate_limiter.php';
include_once '../../config/api_helpers.php';
include_once '../../lib/password_policy.php';
include_once '../../models/Consent.php';
include_once '../../models/User.php';
include_once '../../models/EmailVerification.php';
include_once '../../lib/email_verification_mail.php';
include_once '../../lib/signup_code_guard.php';

try {
    $raw_data = file_get_contents("php://input");
    if (!$raw_data) {
        throw new Exception("No data provided");
    }

    $data = json_decode($raw_data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON format: " . json_last_error_msg());
    }

    $database = new Database();
    $db = $database->getConnection();

    $user = new User($db);

    // Rate limiter (DB-backed, swappable a Redis)
    $limiter = rate_limiter($db);

    // Make sure data is not empty and contains all required fields
    if (
        !empty($data) &&
        isset($data->username) && isset($data->email) && isset($data->password) &&
        !empty($data->username) && !empty($data->email) && !empty($data->password)
    ) {
        // Throttling per-IP: anti registrazioni di massa
        $regKey = client_ip_key('register');
        list($regMax, $regDecay) = rate_limit_rule('register_ip');

        if ($limiter->tooManyAttempts($regKey, $regMax)) {
            $retryAfter = $limiter->availableIn($regKey);
            header('Retry-After: ' . $retryAfter);
            http_response_code(429);
            echo json_encode(array(
                "success" => false,
                "message" => t_server('register.too_many', array('seconds' => $retryAfter))
            ));
            exit;
        }

        // Conta questo tentativo di registrazione
        $limiter->hit($regKey, $regDecay);

        // Stesse regole di User::validateInputs(), ma con un messaggio preciso: altrimenti
        // create() fallisce e l'utente legge "nome utente o email gia' in uso".
        if (!is_string($data->username) || !preg_match(User::USERNAME_PATTERN, $data->username)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.username_invalid')));
            exit;
        }
        if (!is_string($data->email) || !filter_var(trim($data->email), FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('common.email_invalid')));
            exit;
        }

        $passwordError = password_policy_error($data->password);
        if ($passwordError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $passwordError));
            exit;
        }

        // Data di nascita obbligatoria e valida (eta' minima 14 anni) e sesso scelto dall'utente.
        $birthError = birth_date_error(isset($data->birth_date) ? $data->birth_date : null);
        if ($birthError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $birthError));
            exit;
        }
        if (!isset($data->gender) || !valid_gender($data->gender)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.gender_required')));
            exit;
        }

        // Termini d'uso e informativa privacy vanno accettati esplicitamente
        if (!isset($data->accept_terms) || $data->accept_terms !== true) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('register.terms_required')));
            exit;
        }

        // Codice di registrazione facoltativo: se c'è e non si può usare la registrazione si ferma. Il limite per IP
        // conta solo i codici sbagliati e si controlla prima di guardare il database.
        $signupCode = signup_code_field($data);
        $signupGuard = $signupCode !== null ? signup_code_rate_guard($limiter) : null;

        $user->username = $data->username;
        $user->email = strtolower(trim($data->email));
        $user->password = $data->password;
        $user->birth_date = $data->birth_date;
        $user->gender = $data->gender;
        $tsd = isset($data->training_start_date) ? $data->training_start_date : null;
        $tsdError = training_start_date_error($tsd);
        if ($tsdError !== null) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => $tsdError));
            exit;
        }
        $user->training_start_date = ($tsd === '') ? null : $tsd;
        $user->locale = normalize_locale(isset($data->locale) ? $data->locale : null) ?: 'it';
        // Unità di peso facoltativa: assente = kg; presente ma non valida = nessun account
        if (property_exists($data, 'weight_unit') && !valid_weight_unit($data->weight_unit)) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => t_server('settings.weight_unit_invalid')));
            exit;
        }
        $user->weight_unit = isset($data->weight_unit) ? $data->weight_unit : 'kg';

        // Username o email già in uso: messaggio preciso e campo da correggere (lo stesso dice
        // check_availability.php al primo passo; create() resta comunque il controllo finale).
        $respondTaken = function () use ($user) {
            $taken = $user->usernameExists() ? 'username' : ($user->emailExists() ? 'email' : null);
            if ($taken !== null) {
                http_response_code(409);
                $message = $taken === 'username' ? t_server('register.username_taken') : t_server('register.email_taken');
                echo json_encode(array("success" => false, "field" => $taken, "message" => $message));
                exit;
            }
        };
        $respondTaken();

        // Con un codice, utente e uso 'pending' nascono nella stessa transazione, con la riga del codice bloccata:
        // due registrazioni sull'ultimo posto si accodano e una sola passa. Senza codice nulla cambia.
        $signupCodeRow = null;
        if ($signupCode !== null) {
            $locked = SignupCode::lockForRegistration($db, $signupCode);
            if ($locked['status'] !== 'ok') {
                signup_code_fail($limiter, $signupGuard, $locked['status']);
            }
            $signupCodeRow = $locked['code'];
        }

        // Create the user
        if ($user->create()) {
            if ($signupCodeRow !== null) {
                SignupCode::recordPendingUse($db, $signupCodeRow['id'], (int)$user->id);
                $db->commit();
            }
            (new Consent($db))->grant((int)$user->id, 'terms');
            // L'account nasce non confermato (email_verified_at NULL). Il codice parte dopo la risposta, nella
            // lingua dell'account: la registrazione riesce anche se l'email non parte.
            $newId = (int)$user->id;
            $newEmail = $user->email;
            $newName = $user->username;
            $newLang = $user->locale;
            after_response(function () use ($db, $newId, $newEmail, $newName, $newLang) {
                $code = (new EmailVerification($db))->issueForRegistration($newId);
                if ($code !== null) {
                    email_verification_send_code($newEmail, $newName, $newLang, $code);
                }
            });
            $response = array(
                "success" => true,
                "message" => t_server('register.ok')
            );
            if ($signupCodeRow !== null) {
                $response["signup_code"] = array(
                    "tier" => $signupCodeRow['tier'],
                    "duration_days" => $signupCodeRow['duration_days'] === null ? null : (int)$signupCodeRow['duration_days']
                );
            }
            http_response_code(201);
            echo json_encode($response);
        } else {
            if ($signupCodeRow !== null && $db->inTransaction()) {
                $db->rollBack();
            }
            // Il doppione può essere stato preso tra il controllo e l'inserimento: stessa risposta del controllo
            $respondTaken();
            http_response_code(400);
            echo json_encode(array(
                "success" => false,
                "message" => t_server('register.failed')
            ));
        }
    } else {
        http_response_code(400);
        echo json_encode(array(
            "success" => false,
            "message" => t_server('register.incomplete')
        ));
    }
} catch (Exception $e) {
    if (isset($db) && $db && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log("Registration Error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => t_server('register.error')
    ));
}
