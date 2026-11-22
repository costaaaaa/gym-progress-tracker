<?php
// Eseguito da tests/exercise_usage.sh (serve un database con lo schema del repo).
// Argomenti: cartella backend da provare.
//
// Exercise::usageCount() decide se l'admin può eliminare un esercizio: deve contare anche le righe di
// gamification legate all'esercizio (gym_exercise_gamification, gym_workout_exercise_rewards), che
// l'eliminazione cancellerebbe in silenzio (ON DELETE CASCADE). La riga per esercizio sopravvive
// alla cancellazione dell'allenamento: undo_workout_gamification toglie gli XP ma non la riga.
require $argv[1] . '/config/database.php';
require_once $argv[1] . '/config/api_helpers.php';
require_once $argv[1] . '/models/Exercise.php';
require_once $argv[1] . '/models/WorkoutHistory.php';
require_once $argv[1] . '/lib/workout_gamification.php';

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

$conn = (new Database())->getConnection();
$exercise = new Exercise($conn);

function newExercise($conn, $name)
{
    $conn->prepare("INSERT INTO gym_exercises (name, muscle_group, status) VALUES (?, 'Petto', 'approved')")->execute([$name]);
    return (int)$conn->lastInsertId();
}

function newWorkout($conn, $userId)
{
    $conn->prepare("INSERT INTO gym_workout_history (user_id, date) VALUES (?, NOW())")->execute([$userId]);
    return (int)$conn->lastInsertId();
}

function adminUses($exercise, $id)
{
    foreach ($exercise->adminList('approved') as $row) {
        if ($row['id'] === $id) {
            return $row['uses'];
        }
    }
    return null;
}

$conn->prepare("INSERT INTO gym_users (username, email, password) VALUES (?, ?, ?)")
    ->execute(['usage', 'usage@example.test', password_hash('Prova!Uso2026', PASSWORD_DEFAULT)]);
$u = (int)$conn->lastInsertId();

echo "Esercizio mai usato\n";
$unused = newExercise($conn, 'Mai usato');
check('usageCount 0', $exercise->usageCount($unused) === 0);
check('adminList uses 0', adminUses($exercise, $unused) === 0);

echo "Esercizio con una serie\n";
$withSet = newExercise($conn, 'Con una serie');
$w = newWorkout($conn, $u);
$conn->prepare("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps) VALUES (?, ?, 1, 50, '10')")->execute([$w, $withSet]);
check('usageCount 1', $exercise->usageCount($withSet) === 1);
check('adminList uses coerente', adminUses($exercise, $withSet) === 1);

echo "Esercizio allenato una volta e allenamento cancellato (percorso di delete.php)\n";
$trained = newExercise($conn, 'Allenato e cancellato');
$w = newWorkout($conn, $u);
$conn->prepare("INSERT INTO gym_workout_sets (workout_history_id, exercise_id, set_number, weight, reps) VALUES (?, ?, 1, 50, '10')")->execute([$w, $trained]);
$conn->prepare("INSERT INTO gym_exercise_gamification (user_id, exercise_id, xp, level) VALUES (?, ?, 40, 2)")->execute([$u, $trained]);
$conn->prepare("INSERT INTO gym_workout_exercise_rewards (workout_id, exercise_id, user_id, xp, is_pr, day) VALUES (?, ?, ?, 40, 0, CURDATE())")->execute([$w, $trained, $u]);
$h = new WorkoutHistory($conn);
$h->id = $w;
$h->user_id = $u;
$conn->beginTransaction();
undo_workout_gamification($conn, $u, $w);
$h->delete();
$conn->commit();
$sets = (int)$conn->query("SELECT COUNT(*) FROM gym_workout_sets WHERE exercise_id = $trained")->fetchColumn();
$gam = (int)$conn->query("SELECT COUNT(*) FROM gym_exercise_gamification WHERE exercise_id = $trained")->fetchColumn();
$rew = (int)$conn->query("SELECT COUNT(*) FROM gym_workout_exercise_rewards WHERE exercise_id = $trained")->fetchColumn();
check("dopo la cancellazione: serie $sets, riga per esercizio $gam, premi $rew", $sets === 0 && $gam === 1 && $rew === 0);
check('usageCount conta la riga di gamification rimasta', $exercise->usageCount($trained) === 1, 'usageCount = ' . $exercise->usageCount($trained));
check('adminList uses coerente con usageCount', adminUses($exercise, $trained) === $exercise->usageCount($trained));

echo "Esercizio con solo un premio per esercizio (allenamento senza serie di quell'esercizio)\n";
$reward = newExercise($conn, 'Solo premio');
$w = newWorkout($conn, $u);
$conn->prepare("INSERT INTO gym_workout_exercise_rewards (workout_id, exercise_id, user_id, xp, is_pr, day) VALUES (?, ?, ?, 10, 0, CURDATE())")->execute([$w, $reward, $u]);
check('usageCount conta il premio', $exercise->usageCount($reward) === 1, 'usageCount = ' . $exercise->usageCount($reward));
check('adminList uses coerente con usageCount', adminUses($exercise, $reward) === $exercise->usageCount($reward));

echo "\nCONTROLLI $checks FALLITI $fails\n";
exit($fails > 0 ? 1 : 0);
