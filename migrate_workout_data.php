<?php
// Configurazione dell'accesso al database
include_once 'backend/config/database.php';

// Attiva la visualizzazione degli errori per il debug
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Avvio migrazione dei dati workout...<br>";

// Connessione al database
$database = new Database();
$db = $database->getConnection();

// Contatori per il report
$total_workouts = 0;
$migrated_sets = 0;
$workouts_with_errors = 0;
$exercises_not_found = 0;

try {
    // Ottieni tutti i workout history
    $query = "SELECT id, user_id, exercises, date, notes FROM gym_workout_history";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    // Per ogni workout history
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $workout_id = $row['id'];
        $user_id = $row['user_id'];
        $date = $row['date'];
        $notes = $row['notes'];
        $total_workouts++;
        
        echo "Elaborazione workout ID: {$workout_id}, Data: {$date}<br>";
        
        // Estrai gli esercizi dal JSON
        $exercises = json_decode($row['exercises'], true);
        
        if (!is_array($exercises)) {
            echo "⚠️ Errore nel decodificare il JSON per workout_id: {$workout_id}<br>";
            $workouts_with_errors++;
            continue;
        }
        
        $exercise_count = count($exercises);
        echo "Trovati {$exercise_count} esercizi nel workout<br>";
        
        // Per ogni esercizio, trova l'ID corretto in gym_exercises
        foreach ($exercises as $exercise) {
            if (!isset($exercise['exercise_name'])) {
                echo "⚠️ Nome esercizio mancante in un set del workout {$workout_id}<br>";
                continue;
            }
            
            $exercise_name = $exercise['exercise_name'];
            $exercise_id = isset($exercise['exercise_id']) ? $exercise['exercise_id'] : null;
            
            // Verifica se l'ID è già corretto
            $check_existing_query = "SELECT COUNT(*) as count FROM gym_exercises WHERE id = ?";
            $check_existing_stmt = $db->prepare($check_existing_query);
            $check_existing_stmt->bindParam(1, $exercise_id);
            $check_existing_stmt->execute();
            $check_result = $check_existing_stmt->fetch(PDO::FETCH_ASSOC);
            
            $correct_exercise_id = null;
            
            if ($check_result['count'] > 0) {
                // L'ID è già valido
                $correct_exercise_id = $exercise_id;
                echo "✓ ID esercizio {$exercise_id} è valido per '{$exercise_name}'<br>";
            } else {
                // Cerca l'ID corretto basandosi sul nome
                $exercise_query = "SELECT id FROM gym_exercises WHERE name = ?";
                $exercise_stmt = $db->prepare($exercise_query);
                $exercise_stmt->bindParam(1, $exercise_name);
                $exercise_stmt->execute();
                
                $exercise_row = $exercise_stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($exercise_row) {
                    $correct_exercise_id = $exercise_row['id'];
                    echo "✓ Trovato ID corretto {$correct_exercise_id} per '{$exercise_name}'<br>";
                } else {
                    // Prova con ricerca fuzzy
                    $fuzzy_query = "SELECT id, name FROM gym_exercises WHERE name LIKE ?";
                    $exercise_stmt = $db->prepare($fuzzy_query);
                    $search_term = "%" . $exercise_name . "%";
                    $exercise_stmt->bindParam(1, $search_term);
                    $exercise_stmt->execute();
                    
                    $exercise_row = $exercise_stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($exercise_row) {
                        $correct_exercise_id = $exercise_row['id'];
                        echo "✓ Trovato match simile: ID {$correct_exercise_id} ('{$exercise_row['name']}') per '{$exercise_name}'<br>";
                    } else {
                        echo "⚠️ Esercizio non trovato: '{$exercise_name}' in workout_id: {$workout_id}<br>";
                        $exercises_not_found++;
                        continue;
                    }
                }
            }
            
            if ($correct_exercise_id) {
                // Inserisci nella nuova tabella gym_workout_sets
                $insert_query = "INSERT INTO gym_workout_sets 
                                (workout_history_id, exercise_id, set_number, weight, reps) 
                                VALUES (?, ?, ?, ?, ?)";
                
                $set_number = isset($exercise['set_number']) ? $exercise['set_number'] : 1;
                $weight = isset($exercise['weight']) ? $exercise['weight'] : 0;
                $reps = isset($exercise['reps']) ? $exercise['reps'] : 0;
                
                $insert_stmt = $db->prepare($insert_query);
                $insert_stmt->bindParam(1, $workout_id);
                $insert_stmt->bindParam(2, $correct_exercise_id);
                $insert_stmt->bindParam(3, $set_number);
                $insert_stmt->bindParam(4, $weight);
                $insert_stmt->bindParam(5, $reps);
                
                try {
                    $insert_result = $insert_stmt->execute();
                    if ($insert_result) {
                        $migrated_sets++;
                        echo "✓ Set migrato correttamente<br>";
                    } else {
                        echo "⚠️ Errore nell'inserimento del set<br>";
                    }
                } catch (PDOException $e) {
                    echo "⚠️ Errore database: " . $e->getMessage() . "<br>";
                }
            }
        }
        
        echo "<hr>";
    }
    
    // Riporto finale
    echo "<h3>Migrazione completata</h3>";
    echo "Totale workout elaborati: {$total_workouts}<br>";
    echo "Set migrati con successo: {$migrated_sets}<br>";
    echo "Workout con errori: {$workouts_with_errors}<br>";
    echo "Esercizi non trovati: {$exercises_not_found}<br>";
    
} catch (PDOException $e) {
    echo "Errore durante la migrazione: " . $e->getMessage();
}
?> 