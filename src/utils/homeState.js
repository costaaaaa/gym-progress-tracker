// Stato dell'apertura della Home e giorno della settimana. Funzioni pure, copiate uguali nell'app:
// niente import non relativi e niente window/document/localStorage/navigator.

// 'resume' (bozza aperta) → 'done' (allenato oggi) → 'goal' (obiettivo della settimana raggiunto) → 'todo'
export const homeState = ({ hasDraft, trainedToday, weeklyWorkouts, weeklyGoal }) => {
  if (hasDraft) return 'resume';
  if (trainedToday) return 'done';
  if (weeklyGoal > 0 && weeklyWorkouts >= weeklyGoal) return 'goal';
  return 'todo';
};

// Gli stati con l'apertura rossa: oggi c'è ancora da allenarsi (o da finire)
export const isRedState = (state) => state === 'todo' || state === 'resume';

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// 0 = lunedì … 6 = domenica di 'YYYY-MM-DD' (la data di oggi la dà il server), senza fuso; -1 se la stringa non è una data
export const todayIndex = (today) => {
  const match = DAY_RE.exec(typeof today === 'string' ? today : '');
  if (!match) return -1;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return -1;
  return (date.getUTCDay() + 6) % 7;
};
