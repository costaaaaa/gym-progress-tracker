-- Catalogo esercizi (4 ottobre 2026): nomi italiani uniformi, name_en, equipment, unione dei doppioni.
-- Richiede la sezione 17 di schema_alter_migrations.sql (colonne name_en, equipment, merged_into).
-- I doppioni non si cancellano: sono nascosti (status = 'rejected', created_by NULL, merged_into = voce
-- che resta) e serie, schede e progressi passano alla voce che resta. Rieseguibile.

START TRANSACTION;

-- 1. Nomi, name_en e attrezzo delle voci che restano

UPDATE gym_exercises SET name = 'Panca Piana (Bilanciere)', name_en = 'Barbell Bench Press', equipment = 'bilanciere' WHERE id = 1;
UPDATE gym_exercises SET name = 'Panca Piana (Manubri)', name_en = 'Dumbbell Bench Press', equipment = 'manubri' WHERE id = 2;
UPDATE gym_exercises SET name = 'Panca Inclinata (Bilanciere)', name_en = 'Incline Barbell Bench Press', equipment = 'bilanciere' WHERE id = 3;
UPDATE gym_exercises SET name = 'Panca Inclinata (Manubri)', name_en = 'Incline Dumbbell Bench Press', equipment = 'manubri' WHERE id = 67;
UPDATE gym_exercises SET name = 'Panca Inclinata (Multipower)', name_en = 'Incline Smith Machine Bench Press', equipment = 'multipower' WHERE id = 4;
UPDATE gym_exercises SET name = 'Panca Declinata (Bilanciere)', name_en = 'Decline Barbell Bench Press', equipment = 'bilanciere' WHERE id = 71;
UPDATE gym_exercises SET name = 'Panca Declinata (Manubri)', name_en = 'Decline Dumbbell Bench Press', equipment = 'manubri' WHERE id = 84;
UPDATE gym_exercises SET name = 'Chest Press', name_en = 'Machine Chest Press', equipment = 'macchina' WHERE id = 5;
UPDATE gym_exercises SET name = 'Chest Fly (Macchina)', name_en = 'Pec Deck Fly', equipment = 'macchina' WHERE id = 89;
UPDATE gym_exercises SET name = 'Croci Panca Piana (Manubri)', name_en = 'Dumbbell Fly', equipment = 'manubri' WHERE id = 7;
UPDATE gym_exercises SET name = 'Croci Panca Inclinata (Manubri)', name_en = 'Incline Dumbbell Fly', equipment = 'manubri' WHERE id = 68;
UPDATE gym_exercises SET name = 'Croci ai Cavi', name_en = 'Cable Crossover', equipment = 'cavi' WHERE id = 6;
UPDATE gym_exercises SET name = 'Croci Panca Piana (Cavi)', name_en = 'Flat Bench Cable Fly', equipment = 'cavi' WHERE id = 194;
UPDATE gym_exercises SET name = 'Croci Panca Inclinata (Cavi)', name_en = 'Incline Cable Fly', equipment = 'cavi' WHERE id = 195;
UPDATE gym_exercises SET name = 'Croci ai Cavi Alti a 90', name_en = 'High Cable Fly', equipment = 'cavi' WHERE id = 63;
UPDATE gym_exercises SET name = 'Flessioni', name_en = 'Push-up', equipment = 'corpo_libero' WHERE id = 8;
UPDATE gym_exercises SET name = 'Pullover (Manubrio)', name_en = 'Dumbbell Pullover', equipment = 'manubri' WHERE id = 90;
UPDATE gym_exercises SET name = 'Trazioni', name_en = 'Pull-up', equipment = 'corpo_libero' WHERE id = 9;
UPDATE gym_exercises SET name = 'Lat Machine', name_en = 'Lat Pulldown', equipment = 'macchina' WHERE id = 15;
UPDATE gym_exercises SET name = 'Lat Machine Divergente', name_en = 'Diverging Lat Pulldown', equipment = 'macchina' WHERE id = 20;
UPDATE gym_exercises SET name = 'Trazy Bar', name_en = 'Neutral-Grip Lat Pulldown', equipment = 'macchina' WHERE id = 16;
UPDATE gym_exercises SET name = 'Pull Down', name_en = 'Straight-Arm Pulldown', equipment = 'cavi' WHERE id = 14;
UPDATE gym_exercises SET name = 'Pulley', name_en = 'Seated Cable Row', equipment = 'cavi' WHERE id = 11;
UPDATE gym_exercises SET name = 'Pulley Alto', name_en = 'High Cable Row', equipment = 'cavi' WHERE id = 12;
UPDATE gym_exercises SET name = 'Pulley Braccio Singolo', name_en = 'Single-Arm Cable Row', equipment = 'cavi' WHERE id = 196;
UPDATE gym_exercises SET name = 'Rowing', name_en = 'Machine Row', equipment = 'macchina' WHERE id = 10;
UPDATE gym_exercises SET name = 'Rowing Braccio Singolo', name_en = 'Single-Arm Machine Row', equipment = 'macchina' WHERE id = 65;
UPDATE gym_exercises SET name = 'Rematore (Bilanciere)', name_en = 'Barbell Bent-Over Row', equipment = 'bilanciere' WHERE id = 18;
UPDATE gym_exercises SET name = 'Rematore Presa Inversa (Bilanciere)', name_en = 'Reverse-Grip Barbell Row', equipment = 'bilanciere' WHERE id = 19;
UPDATE gym_exercises SET name = 'Rematore (Manubrio)', name_en = 'One-Arm Dumbbell Row', equipment = 'manubri' WHERE id = 13;
UPDATE gym_exercises SET name = 'Rematore (Multipower)', name_en = 'Smith Machine Row', equipment = 'multipower' WHERE id = 197;
UPDATE gym_exercises SET name = 'Rematore Presa Inversa (Multipower)', name_en = 'Reverse-Grip Smith Machine Row', equipment = 'multipower' WHERE id = 74;
UPDATE gym_exercises SET name = 'T. Bar (Bilanciere)', name_en = 'T-Bar Row', equipment = 'bilanciere' WHERE id = 17;
UPDATE gym_exercises SET name = 'Face Pull', name_en = 'Face Pull', equipment = 'cavi' WHERE id = 105;
UPDATE gym_exercises SET name = 'Scrollate (Bilanciere)', name_en = 'Barbell Shrug', equipment = 'bilanciere' WHERE id = 106;
UPDATE gym_exercises SET name = 'Scrollate (Manubri)', name_en = 'Dumbbell Shrug', equipment = 'manubri' WHERE id = 107;
UPDATE gym_exercises SET name = 'Lento Avanti (Bilanciere)', name_en = 'Barbell Overhead Press', equipment = 'bilanciere' WHERE id = 22;
UPDATE gym_exercises SET name = 'Shoulder Press (Macchina)', name_en = 'Machine Shoulder Press', equipment = 'macchina' WHERE id = 23;
UPDATE gym_exercises SET name = 'Lento Dietro', name_en = 'Behind-the-Neck Press', equipment = 'bilanciere' WHERE id = 110;
UPDATE gym_exercises SET name = 'Arnold Press', name_en = 'Arnold Press', equipment = 'manubri' WHERE id = 112;
UPDATE gym_exercises SET name = 'Alzate Laterali', name_en = 'Dumbbell Lateral Raise', equipment = 'manubri' WHERE id = 24;
UPDATE gym_exercises SET name = 'Alzate Frontali (Bilanciere)', name_en = 'Barbell Front Raise', equipment = 'bilanciere' WHERE id = 25;
UPDATE gym_exercises SET name = 'Alzate Frontali (Manubri)', name_en = 'Dumbbell Front Raise', equipment = 'manubri' WHERE id = 26;
UPDATE gym_exercises SET name = 'Alzate Posteriori (Manubri)', name_en = 'Bent-Over Dumbbell Rear Delt Raise', equipment = 'manubri' WHERE id = 117;
UPDATE gym_exercises SET name = 'Alzate Posteriori (Cavi)', name_en = 'Cable Rear Delt Fly', equipment = 'cavi' WHERE id = 118;
UPDATE gym_exercises SET name = 'Rowing Gomiti Alti (Macchina)', name_en = 'Machine Upright Row', equipment = 'macchina' WHERE id = 28;
UPDATE gym_exercises SET name = 'Curl (Bilanciere)', name_en = 'Barbell Curl', equipment = 'bilanciere' WHERE id = 29;
UPDATE gym_exercises SET name = 'Curl (Bilanciere EZ)', name_en = 'EZ-Bar Curl', equipment = 'bilanciere' WHERE id = 121;
UPDATE gym_exercises SET name = 'Curl (Manubri)', name_en = 'Dumbbell Curl', equipment = 'manubri' WHERE id = 30;
UPDATE gym_exercises SET name = 'Curl Alternato (Manubri)', name_en = 'Alternating Dumbbell Curl', equipment = 'manubri' WHERE id = 31;
UPDATE gym_exercises SET name = 'Curl a Martello', name_en = 'Hammer Curl', equipment = 'manubri' WHERE id = 34;
UPDATE gym_exercises SET name = 'Curl Concentrato', name_en = 'Concentration Curl', equipment = 'manubri' WHERE id = 32;
UPDATE gym_exercises SET name = 'Curl Panca 45 (Manubri)', name_en = 'Incline Dumbbell Curl', equipment = 'manubri' WHERE id = 36;
UPDATE gym_exercises SET name = 'Curl Cavo Basso', name_en = 'Low Cable Curl', equipment = 'cavi' WHERE id = 33;
UPDATE gym_exercises SET name = 'Curl Cavo Alto', name_en = 'High Cable Curl', equipment = 'cavi' WHERE id = 126;
UPDATE gym_exercises SET name = 'Panca Scott (Bilanciere EZ)', name_en = 'EZ-Bar Preacher Curl', equipment = 'bilanciere' WHERE id = 35;
UPDATE gym_exercises SET name = 'Drag Curl', name_en = 'Drag Curl', equipment = 'bilanciere' WHERE id = 129;
UPDATE gym_exercises SET name = 'Zottman Curl', name_en = 'Zottman Curl', equipment = 'manubri' WHERE id = 130;
UPDATE gym_exercises SET name = 'French Press (Manubrio)', name_en = 'Overhead Dumbbell Triceps Extension', equipment = 'manubri' WHERE id = 39;
UPDATE gym_exercises SET name = 'French Press (Manubri)', name_en = 'Lying Dumbbell Triceps Extension', equipment = 'manubri' WHERE id = 41;
UPDATE gym_exercises SET name = 'French Press Panca Piana (Bilanciere)', name_en = 'Lying Barbell Triceps Extension', equipment = 'bilanciere' WHERE id = 43;
UPDATE gym_exercises SET name = 'French Press Panca Inclinata (Bilanciere)', name_en = 'Incline Barbell Triceps Extension', equipment = 'bilanciere' WHERE id = 42;
UPDATE gym_exercises SET name = 'Overhead Extension (Cavi)', name_en = 'Cable Overhead Triceps Extension', equipment = 'cavi' WHERE id = 142;
UPDATE gym_exercises SET name = 'Push Down Corda', name_en = 'Rope Pushdown', equipment = 'cavi' WHERE id = 37;
UPDATE gym_exercises SET name = 'Push Down Sbarra', name_en = 'Bar Pushdown', equipment = 'cavi' WHERE id = 38;
UPDATE gym_exercises SET name = 'Push Down Presa Inversa', name_en = 'Reverse-Grip Pushdown', equipment = 'cavi' WHERE id = 135;
UPDATE gym_exercises SET name = 'Kick Back', name_en = 'Triceps Kickback', equipment = 'manubri' WHERE id = 40;
UPDATE gym_exercises SET name = 'Panca Piana Presa Stretta (Bilanciere)', name_en = 'Close-Grip Bench Press', equipment = 'bilanciere' WHERE id = 76;
UPDATE gym_exercises SET name = 'Dips', name_en = 'Dips', equipment = 'corpo_libero' WHERE id = 45;
UPDATE gym_exercises SET name = 'Dip alla Panca', name_en = 'Bench Dip', equipment = 'corpo_libero' WHERE id = 146;
UPDATE gym_exercises SET name = 'Squat (Bilanciere)', name_en = 'Barbell Back Squat', equipment = 'bilanciere', muscle_group = 'gambe' WHERE id = 46;
UPDATE gym_exercises SET name = 'Box Squat', name_en = 'Box Squat', equipment = 'bilanciere', muscle_group = 'gambe' WHERE id = 148;
UPDATE gym_exercises SET name = 'Goblet Squat', name_en = 'Goblet Squat', equipment = 'manubri', muscle_group = 'gambe' WHERE id = 150;
UPDATE gym_exercises SET name = 'Sumo Squat', name_en = 'Dumbbell Sumo Squat', equipment = 'manubri', muscle_group = 'gambe' WHERE id = 149;
UPDATE gym_exercises SET name = 'Bulgarian Split Squat', name_en = 'Bulgarian Split Squat', equipment = 'manubri', muscle_group = 'gambe' WHERE id = 155;
UPDATE gym_exercises SET name = 'Affondi', name_en = 'Dumbbell Lunge', equipment = 'manubri', muscle_group = 'gambe' WHERE id = 51;
UPDATE gym_exercises SET name = 'Hack Squat 45', name_en = 'Hack Squat', equipment = 'macchina', muscle_group = 'gambe' WHERE id = 49;
UPDATE gym_exercises SET name = 'Leg Press 45', name_en = '45-Degree Leg Press', equipment = 'macchina', muscle_group = 'gambe' WHERE id = 47;
UPDATE gym_exercises SET name = 'Pendulum Squat', name_en = 'Pendulum Squat', equipment = 'macchina', muscle_group = 'gambe' WHERE id = 50;
UPDATE gym_exercises SET name = 'Adductor Machine', name_en = 'Hip Adduction Machine', equipment = 'macchina', muscle_group = 'gambe' WHERE id = 157;
UPDATE gym_exercises SET name = 'Stacco da Terra (Bilanciere)', name_en = 'Barbell Deadlift', equipment = 'bilanciere', muscle_group = 'gambe' WHERE id = 156;
UPDATE gym_exercises SET name = 'Stacco da Terra (Manubri)', name_en = 'Dumbbell Deadlift', equipment = 'manubri', muscle_group = 'gambe' WHERE id = 77;
UPDATE gym_exercises SET name = 'Leg Extension', name_en = 'Leg Extension', equipment = 'macchina', muscle_group = 'quadricipiti' WHERE id = 48;
UPDATE gym_exercises SET name = 'Leg Extension Gamba Singola', name_en = 'Single-Leg Extension', equipment = 'macchina', muscle_group = 'quadricipiti' WHERE id = 66;
UPDATE gym_exercises SET name = 'Sissy Squat', name_en = 'Sissy Squat', equipment = 'corpo_libero', muscle_group = 'quadricipiti' WHERE id = 55;
UPDATE gym_exercises SET name = 'Leg Curl Sdraiato', name_en = 'Lying Leg Curl', equipment = 'macchina', muscle_group = 'femorali' WHERE id = 162;
UPDATE gym_exercises SET name = 'Leg Curl Seduto', name_en = 'Seated Leg Curl', equipment = 'macchina', muscle_group = 'femorali' WHERE id = 163;
UPDATE gym_exercises SET name = 'Leg Curl In Piedi', name_en = 'Standing Leg Curl', equipment = 'macchina', muscle_group = 'femorali' WHERE id = 53;
UPDATE gym_exercises SET name = 'Nordic Curl', name_en = 'Nordic Hamstring Curl', equipment = 'corpo_libero', muscle_group = 'femorali' WHERE id = 164;
UPDATE gym_exercises SET name = 'Stacco Rumeno', name_en = 'Romanian Deadlift', equipment = 'bilanciere', muscle_group = 'femorali' WHERE id = 166;
UPDATE gym_exercises SET name = 'Good Morning', name_en = 'Good Morning', equipment = 'bilanciere', muscle_group = 'femorali' WHERE id = 167;
UPDATE gym_exercises SET name = 'Iperextension', name_en = 'Hyperextension', equipment = 'macchina', muscle_group = 'femorali' WHERE id = 54;
UPDATE gym_exercises SET name = 'Hip Thrust (Bilanciere)', name_en = 'Barbell Hip Thrust', equipment = 'bilanciere', muscle_group = 'glutei' WHERE id = 169;
UPDATE gym_exercises SET name = 'Hip Thrust (Macchina)', name_en = 'Machine Hip Thrust', equipment = 'macchina', muscle_group = 'glutei' WHERE id = 168;
UPDATE gym_exercises SET name = 'Glute Bridge', name_en = 'Glute Bridge', equipment = 'corpo_libero', muscle_group = 'glutei' WHERE id = 170;
UPDATE gym_exercises SET name = 'Glute Kickback (Macchina)', name_en = 'Machine Glute Kickback', equipment = 'macchina', muscle_group = 'glutei' WHERE id = 171;
UPDATE gym_exercises SET name = 'Glute Kickback (Cavi)', name_en = 'Cable Glute Kickback', equipment = 'cavi', muscle_group = 'glutei' WHERE id = 172;
UPDATE gym_exercises SET name = 'Cable Pull Through', name_en = 'Cable Pull-Through', equipment = 'cavi', muscle_group = 'glutei' WHERE id = 174;
UPDATE gym_exercises SET name = 'Abductor Machine', name_en = 'Hip Abduction Machine', equipment = 'macchina', muscle_group = 'glutei' WHERE id = 173;
UPDATE gym_exercises SET name = 'Calf in Piedi', name_en = 'Standing Calf Raise', equipment = 'macchina', muscle_group = 'polpacci' WHERE id = 56;
UPDATE gym_exercises SET name = 'Calf Seduto', name_en = 'Seated Calf Raise', equipment = 'macchina', muscle_group = 'polpacci' WHERE id = 57;
UPDATE gym_exercises SET name = 'Calf alla Leg Press', name_en = 'Leg Press Calf Raise', equipment = 'macchina', muscle_group = 'polpacci' WHERE id = 78;
UPDATE gym_exercises SET name = 'Calf (Manubrio)', name_en = 'Dumbbell Calf Raise', equipment = 'manubri', muscle_group = 'polpacci' WHERE id = 58;
UPDATE gym_exercises SET name = 'Calf su Gradino', name_en = 'Step Calf Raise', equipment = 'corpo_libero', muscle_group = 'polpacci' WHERE id = 179;
UPDATE gym_exercises SET name = 'Donkey Calf Raise', name_en = 'Donkey Calf Raise', equipment = 'macchina', muscle_group = 'polpacci' WHERE id = 180;
UPDATE gym_exercises SET name = 'Crunch', name_en = 'Crunch', equipment = 'corpo_libero' WHERE id = 59;
UPDATE gym_exercises SET name = 'Crunch Cavo Alto', name_en = 'Cable Crunch', equipment = 'cavi' WHERE id = 72;
UPDATE gym_exercises SET name = 'Crunch Inverso Sdraiato', name_en = 'Lying Reverse Crunch', equipment = 'corpo_libero' WHERE id = 60;
UPDATE gym_exercises SET name = 'Crunch Inverso Parallele', name_en = 'Vertical Knee Raise', equipment = 'corpo_libero' WHERE id = 73;
UPDATE gym_exercises SET name = 'Bicycle Crunch', name_en = 'Bicycle Crunch', equipment = 'corpo_libero' WHERE id = 183;
UPDATE gym_exercises SET name = 'Sit-up', name_en = 'Sit-up', equipment = 'corpo_libero' WHERE id = 62;
UPDATE gym_exercises SET name = 'Leg Raise', name_en = 'Lying Leg Raise', equipment = 'corpo_libero' WHERE id = 189;
UPDATE gym_exercises SET name = 'Hanging Leg Raise', name_en = 'Hanging Leg Raise', equipment = 'corpo_libero' WHERE id = 190;
UPDATE gym_exercises SET name = 'Dragon Flag', name_en = 'Dragon Flag', equipment = 'corpo_libero' WHERE id = 193;
UPDATE gym_exercises SET name = 'Ab Wheel', name_en = 'Ab Wheel Rollout', equipment = 'corpo_libero' WHERE id = 191;
UPDATE gym_exercises SET name = 'Russian Twist', name_en = 'Russian Twist', equipment = 'corpo_libero' WHERE id = 188;
UPDATE gym_exercises SET name = 'Mountain Climber', name_en = 'Mountain Climber', equipment = 'corpo_libero' WHERE id = 192;
UPDATE gym_exercises SET name = 'Plank', name_en = 'Plank', equipment = 'corpo_libero' WHERE id = 61;
UPDATE gym_exercises SET name = 'Side Plank', name_en = 'Side Plank', equipment = 'corpo_libero' WHERE id = 186;

-- 2. Voci nuove (non si duplicano se il nome esiste gia')

INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'T. Bar (Macchina)', 'Machine T-Bar Row', 'macchina', 'schiena'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'T. Bar (Macchina)');
INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'Lento Avanti (Manubri)', 'Dumbbell Shoulder Press', 'manubri', 'spalle'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'Lento Avanti (Manubri)');
INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'Rowing Gomiti Alti (Manubri)', 'Dumbbell Upright Row', 'manubri', 'spalle'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'Rowing Gomiti Alti (Manubri)');
INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'Rowing Gomiti Alti (Cavi)', 'Cable Upright Row', 'cavi', 'spalle'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'Rowing Gomiti Alti (Cavi)');
INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'Panca Scott (Manubri)', 'Dumbbell Preacher Curl', 'manubri', 'bicipiti'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'Panca Scott (Manubri)');
INSERT INTO gym_exercises (name, name_en, equipment, muscle_group)
SELECT 'Panca Scott (Macchina)', 'Machine Preacher Curl', 'macchina', 'bicipiti'
WHERE NOT EXISTS (SELECT 1 FROM gym_exercises WHERE name = 'Panca Scott (Macchina)');

-- 3. Unioni: serie, schede, progressi e XP passano alla voce che resta; il doppione viene nascosto

-- 88 -> 6
UPDATE gym_workout_sets      SET exercise_id = 6 WHERE exercise_id = 88;
UPDATE gym_workout_exercises SET exercise_id = 6 WHERE exercise_id = 88;
UPDATE gym_progress          SET exercise_id = 6 WHERE exercise_id = 88;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 6, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (6, 88);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (6, 88) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 6;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 88;
UPDATE gym_exercises SET merged_into = 6, status = 'rejected', created_by = NULL WHERE id = 88;

-- 104 -> 11
UPDATE gym_workout_sets      SET exercise_id = 11 WHERE exercise_id = 104;
UPDATE gym_workout_exercises SET exercise_id = 11 WHERE exercise_id = 104;
UPDATE gym_progress          SET exercise_id = 11 WHERE exercise_id = 104;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 11, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (11, 104);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (11, 104) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 11;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 104;
UPDATE gym_exercises SET merged_into = 11, status = 'rejected', created_by = NULL WHERE id = 104;

-- 75 -> 107
UPDATE gym_workout_sets      SET exercise_id = 107 WHERE exercise_id = 75;
UPDATE gym_workout_exercises SET exercise_id = 107 WHERE exercise_id = 75;
UPDATE gym_progress          SET exercise_id = 107 WHERE exercise_id = 75;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 107, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (107, 75);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (107, 75) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 107;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 75;
UPDATE gym_exercises SET merged_into = 107, status = 'rejected', created_by = NULL WHERE id = 75;

-- 21 -> 22
UPDATE gym_workout_sets      SET exercise_id = 22 WHERE exercise_id = 21;
UPDATE gym_workout_exercises SET exercise_id = 22 WHERE exercise_id = 21;
UPDATE gym_progress          SET exercise_id = 22 WHERE exercise_id = 21;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 22, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (22, 21);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (22, 21) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 22;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 21;
UPDATE gym_exercises SET merged_into = 22, status = 'rejected', created_by = NULL WHERE id = 21;

-- 27 -> 117
UPDATE gym_workout_sets      SET exercise_id = 117 WHERE exercise_id = 27;
UPDATE gym_workout_exercises SET exercise_id = 117 WHERE exercise_id = 27;
UPDATE gym_progress          SET exercise_id = 117 WHERE exercise_id = 27;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 117, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (117, 27);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (117, 27) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 117;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 27;
UPDATE gym_exercises SET merged_into = 117, status = 'rejected', created_by = NULL WHERE id = 27;

-- 128 -> 36
UPDATE gym_workout_sets      SET exercise_id = 36 WHERE exercise_id = 128;
UPDATE gym_workout_exercises SET exercise_id = 36 WHERE exercise_id = 128;
UPDATE gym_progress          SET exercise_id = 36 WHERE exercise_id = 128;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 36, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (36, 128);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (36, 128) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 36;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 128;
UPDATE gym_exercises SET merged_into = 36, status = 'rejected', created_by = NULL WHERE id = 128;

-- 143 -> 39
UPDATE gym_workout_sets      SET exercise_id = 39 WHERE exercise_id = 143;
UPDATE gym_workout_exercises SET exercise_id = 39 WHERE exercise_id = 143;
UPDATE gym_progress          SET exercise_id = 39 WHERE exercise_id = 143;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 39, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (39, 143);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (39, 143) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 39;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 143;
UPDATE gym_exercises SET merged_into = 39, status = 'rejected', created_by = NULL WHERE id = 143;

-- 141 -> 43
UPDATE gym_workout_sets      SET exercise_id = 43 WHERE exercise_id = 141;
UPDATE gym_workout_exercises SET exercise_id = 43 WHERE exercise_id = 141;
UPDATE gym_progress          SET exercise_id = 43 WHERE exercise_id = 141;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 43, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (43, 141);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (43, 141) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 43;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 141;
UPDATE gym_exercises SET merged_into = 43, status = 'rejected', created_by = NULL WHERE id = 141;

-- 44 -> 42
UPDATE gym_workout_sets      SET exercise_id = 42 WHERE exercise_id = 44;
UPDATE gym_workout_exercises SET exercise_id = 42 WHERE exercise_id = 44;
UPDATE gym_progress          SET exercise_id = 42 WHERE exercise_id = 44;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 42, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (42, 44);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (42, 44) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 42;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 44;
UPDATE gym_exercises SET merged_into = 42, status = 'rejected', created_by = NULL WHERE id = 44;

-- 52 -> 163
UPDATE gym_workout_sets      SET exercise_id = 163 WHERE exercise_id = 52;
UPDATE gym_workout_exercises SET exercise_id = 163 WHERE exercise_id = 52;
UPDATE gym_progress          SET exercise_id = 163 WHERE exercise_id = 52;
INSERT IGNORE INTO gym_exercise_gamification (user_id, exercise_id, xp, level)
  SELECT DISTINCT user_id, 163, 0, 1 FROM gym_exercise_gamification WHERE exercise_id IN (163, 52);
UPDATE gym_exercise_gamification g
  JOIN (SELECT user_id, SUM(xp) AS s FROM gym_exercise_gamification WHERE exercise_id IN (163, 52) GROUP BY user_id) t
    ON t.user_id = g.user_id
  SET g.xp = t.s, g.level = FLOOR(SQRT(t.s / 100)) + 1
  WHERE g.exercise_id = 163;
DELETE FROM gym_exercise_gamification WHERE exercise_id = 52;
UPDATE gym_exercises SET merged_into = 163, status = 'rejected', created_by = NULL WHERE id = 52;

COMMIT;
