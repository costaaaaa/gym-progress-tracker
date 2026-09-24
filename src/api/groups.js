import { API_BASE_URL } from '../config';

// Endpoint dei gruppi (backend/api/groups/). Ogni funzione ritorna { ok, status, data }
// e non lancia mai: i messaggi d'errore arrivano già in italiano dal server (data.message).
const request = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}api/groups/${path}`, {
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

export const listGroups = () => request('list.php');
export const readGroup = (groupId, board = 'week') =>
  request(`read.php?group_id=${encodeURIComponent(groupId)}&board=${encodeURIComponent(board)}`);
export const previewGroup = (code) => request(`preview.php?code=${encodeURIComponent(code)}`);
export const createGroup = (name, type) => post('create.php', { name, type });
export const joinGroup = (code) => post('join.php', { code, consent: true });
export const leaveGroup = (groupId) => post('leave.php', { group_id: groupId });
export const manageGroup = (groupId, action, extra = {}) => post('manage.php', { group_id: groupId, action, ...extra });

// Link di invito. Il codice sta nella query string, che Umami non registra.
export const inviteLink = (code) => `${window.location.origin}/entra?codice=${code}`;

export const errorMessage = (res, fallback = 'Qualcosa è andato storto. Riprova.') => res?.data?.message || fallback;

export const GROUP_TYPE_LABELS = { friends: 'Amici', gym: 'Palestra', coaching: 'Coaching' };
export const ROLE_LABELS = { owner: 'Proprietario', admin: 'Amministratore', coach: 'Coach', member: 'Membro' };
