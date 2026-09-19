<?php
// Invio email transazionali (recupero password). Driver scelto via env MAIL_DRIVER:
//   log   (default) scrive l'email nel log degli errori PHP: solo per sviluppo, NON invia nulla;
//   brevo           API transazionale Brevo (https://api.brevo.com/v3/smtp/email).
// Per un altro provider basta aggiungere un case in mail_send().
//
// Variabili d'ambiente per 'brevo': MAIL_API_KEY, MAIL_FROM_EMAIL (mittente verificato sul provider),
// MAIL_FROM_NAME (opzionale, default "Liftindex").

/**
 * Invia un'email. Ritorna true se il provider l'ha accettata, false altrimenti (mai eccezioni:
 * chi chiama non deve rivelare all'utente se l'invio è fallito).
 */
function mail_send($to, $subject, $text)
{
    $driver = getenv('MAIL_DRIVER') ?: 'log';

    switch ($driver) {
        case 'brevo':
            return mail_send_brevo($to, $subject, $text);
        case 'log':
        default:
            error_log("[mail:log] a=$to oggetto=\"$subject\"\n$text");
            return true;
    }
}

function mail_send_brevo($to, $subject, $text)
{
    $apiKey = getenv('MAIL_API_KEY') ?: '';
    $fromEmail = getenv('MAIL_FROM_EMAIL') ?: '';
    if ($apiKey === '' || $fromEmail === '' || !function_exists('curl_init')) {
        error_log('mail_send_brevo: configurazione mancante (MAIL_API_KEY, MAIL_FROM_EMAIL o curl)');
        return false;
    }

    $payload = json_encode([
        'sender' => ['email' => $fromEmail, 'name' => getenv('MAIL_FROM_NAME') ?: 'Liftindex'],
        'to' => [['email' => $to]],
        'subject' => $subject,
        'textContent' => $text,
    ]);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['api-key: ' . $apiKey, 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status < 200 || $status >= 300) {
        error_log("mail_send_brevo: HTTP $status " . substr((string) $response, 0, 200));
        return false;
    }
    return true;
}
