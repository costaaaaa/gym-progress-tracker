<?php
// Aiuti comuni dei test PHP con database e server (da includere con require, non da eseguire): check(),
// startTestServer() e call(). Usato da schema_avanzi_test.php e free_limits_test.php, lanciati dai
// rispettivi .sh con MySQL usa e getta (tests/lib/throwaway_mysql.sh). Alla fine il test stampa
// «CONTROLLI <n> FALLITI <m>» e esce con 1 se $fails > 0.

$fails = 0;
$checks = 0;
function check($desc, $cond, $detail = '')
{
    global $fails, $checks;
    $checks++;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
        if ($detail !== '') {
            echo "      $detail\n";
        }
    }
}

// Server integrato di PHP sul backend, nello stesso container: figlio di questo processo, ne eredita
// l'ambiente (DB_*). Si ferma a fine script.
$port = 8099;
function startTestServer($backend)
{
    global $port;
    $server = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $backend], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/tmp/server.log', 'w']], $pipes);
    register_shutdown_function(function () use ($server) {
        proc_terminate($server);
    });
    for ($i = 0; $i < 50; $i++) {
        $sock = @fsockopen('127.0.0.1', $port);
        if ($sock) { fclose($sock); break; }
        usleep(100000);
    }
}

// Chiamata HTTP: ritorna [codice, JSON decodificato come array, corpo grezzo]
function call($method, $path, $token, $body = null)
{
    global $port;
    $headers = "Authorization: Bearer $token\r\nContent-Type: application/json\r\n";
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => $headers, 'ignore_errors' => true, 'timeout' => 30,
        'content' => $body === null ? '' : json_encode($body),
    ]]);
    $raw = file_get_contents("http://127.0.0.1:$port$path", false, $context);
    $code = 0;
    $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
    if (isset($responseHeaders[0]) && preg_match('/ (\d{3})/', $responseHeaders[0], $m)) {
        $code = (int)$m[1];
    }
    return [$code, json_decode((string)$raw, true), (string)$raw];
}
