import { post, request } from './exercises';

// Gruppi lato admin (backend/api/admin/groups.php): ricerca e rinomina senza segnalazione.
export const searchAdminGroups = (q) => request(`admin/groups.php?q=${encodeURIComponent(q)}`);

// La nota è obbligatoria: arriva per email al proprietario. Non cambia il blocco del nome.
export const renameAdminGroup = (id, name, note) => post('admin/groups.php', { action: 'rename', id, name, note });
