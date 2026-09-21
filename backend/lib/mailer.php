<?php
// Invio email transazionali (recupero password). Driver scelto via env MAIL_DRIVER:
//   log   (default) scrive l'email nel log degli errori PHP: solo per sviluppo, NON invia nulla;
//   mail            mail() di PHP, cioè il sendmail del server (Postfix sulla VPS): nessun servizio esterno.
//                   Setup e DNS (SPF, DKIM, DMARC) nel repo privato gym-infra, cartella mail/;
//   brevo           API transazionale Brevo (https://api.brevo.com/v3/smtp/email).
// Per un altro provider basta aggiungere un case in mail_send().
//
// Variabili d'ambiente: MAIL_FROM_EMAIL (mittente, con dominio configurato sul server o sul provider),
// MAIL_FROM_NAME (opzionale, default "Liftindex"); solo per 'brevo' anche MAIL_API_KEY.

/**
 * Invia un'email. Ritorna true se il provider l'ha accettata, false altrimenti (mai eccezioni:
 * chi chiama non deve rivelare all'utente se l'invio è fallito).
 */
function mail_send($to, $subject, $text)
{
    $driver = getenv('MAIL_DRIVER') ?: 'log';

    switch ($driver) {
        case 'mail':
            return mail_send_native($to, $subject, $text);
        case 'brevo':
            return mail_send_brevo($to, $subject, $text);
        case 'log':
        default:
            error_log("[mail:log] a=$to oggetto=\"$subject\"\n$text");
            return true;
    }
}

function mail_send_native($to, $subject, $text)
{
    $fromEmail = getenv('MAIL_FROM_EMAIL') ?: '';
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        error_log('mail_send_native: MAIL_FROM_EMAIL mancante o non valida');
        return false;
    }
    // Niente a-capo nei valori che finiscono negli header (header injection).
    $clean = function ($v) { return str_replace(["\r", "\n"], ' ', $v); };
    $fromName = $clean(getenv('MAIL_FROM_NAME') ?: 'Liftindex');
    $domain = substr(strrchr($fromEmail, '@'), 1);

    $headers = [
        'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'Date: ' . date('r'),
    ];
    $encodedSubject = '=?UTF-8?B?' . base64_encode($clean($subject)) . '?=';

    // -f imposta il mittente della busta (Return-Path): serve allineato al dominio per SPF.
    $ok = mail($to, $encodedSubject, $text, implode("\r\n", $headers), '-f' . $fromEmail);
    if (!$ok) {
        error_log('mail_send_native: mail() ha restituito false');
    }
    return $ok;
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
