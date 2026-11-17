<?php
// Helper condivisi dai test che avviano il server integrato di PHP sul backend e chiamano gli endpoint veri.
// Nessuna costante né variabile globale: porta e connessione si passano ai parametri (chi usa questi helper
// definisce le sue scorciatoie, per esempio api() = httpApi(PORT_A, ...)).

// Avvia `php -S` sul backend: $port, file di log dello stderr (qui finiscono anche le email con MAIL_DRIVER=log)
// e variabili d'ambiente aggiuntive. Il server si ferma alla fine dello script.
function startServer($backend, $port, $log, array $env)
{
    $server = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $backend],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', $log, 'w']], $pipes, null, $env + getenv());
    register_shutdown_function(function () use ($server) {
        proc_terminate($server);
    });
    for ($i = 0; $i < 50; $i++) {
        $sock = @fsockopen('127.0.0.1', $port);
        if ($sock) { fclose($sock); break; }
        usleep(100000);
    }
}

// Query sulla connessione $conn (PDO) passata esplicitamente
function dbSql($conn, $query, $params = [])
{
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    return $stmt;
}
function dbScalar($conn, $query, $params = [])
{
    return dbSql($conn, $query, $params)->fetchColumn();
}
function dbRows($conn, $query, $params = [])
{
    return dbSql($conn, $query, $params)->fetchAll(PDO::FETCH_ASSOC);
}

// Chiamata HTTP alla porta $port: ritorna [status, JSON decodificato, corpo grezzo, intestazioni]
function httpApi($port, $method, $path, $auth = null, $body = null, $extra = [])
{
    $headers = "Content-Type: application/json\r\n";
    if ($auth && isset($auth['bearer'])) $headers .= "Authorization: Bearer {$auth['bearer']}\r\n";
    foreach ($extra as $h) $headers .= "$h\r\n";
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => $headers, 'ignore_errors' => true, 'timeout' => 30,
        'content' => $body === null ? '' : json_encode($body),
    ]]);
    $raw = file_get_contents("http://127.0.0.1:$port$path", false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
    $code = 0;
    if (isset($responseHeaders[0]) && preg_match('/ (\d{3})/', $responseHeaders[0], $m)) $code = (int)$m[1];
    return [$code, json_decode((string)$raw, true), (string)$raw, $responseHeaders ?: []];
}
