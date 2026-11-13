<?php
// Eseguito da tests/workout_plan_active.sh (serve un database con lo schema del repo).
// Argomento: la cartella backend da provare.
require $argv[1] . '/config/database.php';
require $argv[1] . '/models/WorkoutPlan.php';

$fails = 0;
function check($desc, $cond)
{
    global $fails;
    if ($cond) {
        echo "  \033[32m✓\033[0m $desc\n";
    } else {
        $fails++;
        echo "  \033[31m✗\033[0m $desc\n";
    }
}

$conn = (new Database())->getConnection();
$conn->exec("INSERT INTO gym_users (username, email, password) VALUES ('wpa1', 'wpa1@example.test', 'x'), ('wpa2', 'wpa2@example.test', 'x')");
$u1 = (int)$conn->query("SELECT id FROM gym_users WHERE email = 'wpa1@example.test'")->fetchColumn();
$u2 = (int)$conn->query("SELECT id FROM gym_users WHERE email = 'wpa2@example.test'")->fetchColumn();
$conn->exec("INSERT INTO gym_workout_plans (user_id, name, is_active) VALUES ($u1, 'A', 1), ($u2, 'Altra', 1)");
$planA = (int)$conn->query("SELECT id FROM gym_workout_plans WHERE user_id = $u1")->fetchColumn();
$planOther = (int)$conn->query("SELECT id FROM gym_workout_plans WHERE user_id = $u2")->fetchColumn();
$gone = $planOther + 1000;

function activeIds($conn, $u)
{
    return array_map("intval", $conn->query("SELECT id FROM gym_workout_plans WHERE user_id = $u AND is_active = 1 ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
}

function model($conn, $u, $id)
{
    $p = new WorkoutPlan($conn);
    $p->user_id = $u;
    $p->id = $id;
    $p->name = 'X';
    $p->description = '';
    $p->is_active = 1;
    return $p;
}

foreach (['inesistente' => $gone, 'di un altro utente' => $planOther] as $label => $id) {
    echo "Scheda $label\n";
    $p = model($conn, $u1, $id);
    check("updateAtMostOneActive con is_active 1 ritorna false", $p->updateAtMostOneActive() === false);
    check("plan_gone è vero", $p->plan_gone === true);
    check("A resta l'unica attiva", activeIds($conn, $u1) === [$planA]);

    $p = model($conn, $u1, $id);
    check("activateExclusively ritorna false", $p->activateExclusively() === false);
    check("plan_gone è vero", $p->plan_gone === true);
    check("A resta l'unica attiva", activeIds($conn, $u1) === [$planA]);
}
check("la scheda dell'altro utente è rimasta attiva", activeIds($conn, $u2) === [$planOther]);

echo "plan_gone si azzera a ogni chiamata\n";
$p = model($conn, $u1, $gone);
$p->activateExclusively();
$p->id = $planA;
check("su una scheda esistente ritorna true", $p->activateExclusively() === true);
check("plan_gone torna falso", $p->plan_gone === false);

$conn->exec("DELETE FROM gym_users WHERE id IN ($u1, $u2)");
exit($fails ? 1 : 0);
