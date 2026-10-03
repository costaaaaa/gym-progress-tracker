import { API_BASE_URL } from '../config';

// Endpoint degli esercizi (backend/api/exercise/ e backend/api/admin/exercises.php). Ogni funzione
// ritorna { ok, status, data } e non lancia mai: i messaggi d'errore arrivano dal server (data.message).
const request = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok && data?.success === true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { message: 'Connessione non riuscita. Riprova.' } };
  }
};

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

// Esercizio personale: lo vede solo chi lo crea finché un admin non lo approva.
// 409 con data.code === 'duplicate' → data.exercise è quello già esistente, da selezionare.
export const createExercise = (name, muscleGroup) =>
  post('exercise/create.php', { name, muscle_group: muscleGroup });

export const listAdminExercises = (status = 'pending') =>
  request(`admin/exercises.php?status=${encodeURIComponent(status)}`);
export const adminExerciseAction = (action, extra = {}) => post('admin/exercises.php', { action, ...extra });

export const errorMessage = (res, fallback = 'Qualcosa è andato storto. Riprova.') => res?.data?.message || fallback;

// Etichetta per gli esercizi personali (null per quelli del catalogo)
export const personalLabel = (exercise) => {
  if (!exercise?.is_mine || exercise.status === 'approved') return null;
  return exercise.status === 'pending' ? 'Personale · in revisione' : 'Personale';
};
