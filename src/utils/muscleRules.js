// Muscolo principale (conteggio serie settimanali e recupero): le opzioni ammesse per gruppo,
// speculari a muscleAllowedOptions in backend/lib/muscle_rules.php. "gambe" lo richiede sempre
// (nessun default, 5 opzioni); "glutei" propone glutei di default ma accetta anche abduttori;
// gli altri gruppi lo derivano da soli lato server, quindi qui non c'è nulla da scegliere (null).
// Usata da ExerciseDialog.jsx e Admin/AdminExercises.jsx, così le due select non duplicano le liste.
const GAMBE_PRIMARY_MUSCLES = ['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori'];
const GLUTEI_PRIMARY_MUSCLES = ['glutei', 'abduttori'];

export const primaryMuscleOptions = (muscleGroup) => {
  switch ((muscleGroup || '').toLowerCase()) {
    case 'gambe': return GAMBE_PRIMARY_MUSCLES;
    case 'glutei': return GLUTEI_PRIMARY_MUSCLES;
    default: return null;
  }
};
