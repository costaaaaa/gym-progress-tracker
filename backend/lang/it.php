<?php
// Messaggi del server in italiano, letti da t_server() (config/api_helpers.php).
// Stesse chiavi di en.php e stessi {segnaposto}: lo controlla `npm run i18n:check`.
return array(
    'auth.unauthenticated' => 'Accesso non autorizzato. Effettua il login.',
    'auth.missing_credentials' => 'Nome utente e password sono obbligatori.',
    'auth.too_many_logins' => 'Troppi tentativi di accesso. Riprova tra {seconds} secondi.',
    'auth.invalid_credentials' => 'Nome utente o password non validi.',
    'auth.login_ok' => 'Accesso effettuato.',
    'auth.login_error' => "Si è verificato un errore durante l'accesso.",
    'auth.logout_ok' => 'Logout effettuato con successo.',
    'auth.logout_error' => 'Errore durante il logout.',
    'auth.token_missing' => 'Token mancante.',

    'common.email_invalid' => 'Inserisci un indirizzo email valido.',
    'common.too_many_later' => 'Troppi tentativi. Riprova più tardi.',
    'common.error_retry' => 'Si è verificato un errore. Riprova.',

    'password.min_length' => 'La password deve contenere almeno 8 caratteri.',
    'password.max_length' => 'La password non può superare i 72 caratteri.',
    'password.uppercase' => 'La password deve contenere almeno una lettera maiuscola.',
    'password.lowercase' => 'La password deve contenere almeno una lettera minuscola.',
    'password.number' => 'La password deve contenere almeno un numero.',
    'password.special' => 'La password deve contenere almeno un carattere speciale (!@#$%^&*).',

    'birth.invalid' => 'Data di nascita obbligatoria o non valida.',
    'birth.too_young' => 'Devi avere almeno 14 anni per usare LiftIndex.',

    'register.too_many' => 'Troppe registrazioni da questo indirizzo. Riprova tra {seconds} secondi.',
    'register.username_invalid' => 'Il nome utente può contenere solo lettere e numeri (da 3 a 50 caratteri).',
    'register.gender_required' => 'Seleziona il sesso.',
    'register.terms_required' => "Per registrarti devi accettare i termini d'uso e l'informativa privacy.",
    'register.ok' => 'Utente registrato con successo.',
    'register.failed' => "Impossibile registrare l'utente. Il nome utente o l'email potrebbero essere già in uso.",
    'register.incomplete' => 'Dati incompleti. Username, email e password sono obbligatori.',
    'register.error' => 'Si è verificato un errore durante la registrazione.',

    'forgot.sent' => "Se l'indirizzo è registrato, ti abbiamo inviato un'email con le istruzioni per reimpostare la password.",
    'forgot.too_many' => 'Troppe richieste. Riprova più tardi.',
    'forgot.email_subject' => 'Reimposta la tua password',
    'forgot.email_body' => "Ciao {username},\n\n"
        . "abbiamo ricevuto una richiesta per reimpostare la password del tuo account.\n"
        . "Apri questo link entro 1 ora:\n\n{link}\n\n"
        . "Se non l'hai chiesto tu, ignora questa email: la tua password non cambia.\n",

    'reset.missing' => 'Token e nuova password sono obbligatori.',
    'reset.ok' => 'Password reimpostata. Ora puoi accedere.',
    'reset.invalid_link' => 'Il link non è valido o è scaduto. Richiedine uno nuovo.',

    'change_password.missing' => 'Password attuale e nuova password sono obbligatorie.',
    'change_password.same' => 'La nuova password deve essere diversa da quella attuale.',
    'change_password.ok' => 'Password modificata con successo.',
    'change_password.wrong_current' => 'La password attuale non è corretta.',
    'change_password.error' => 'Si è verificato un errore durante il cambio password.',
);
