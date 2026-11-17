import { post, request } from './exercises';

// Codici di registrazione lato admin (backend/api/admin/signup_codes.php). Ogni funzione ritorna { ok, status, data }
// e non lancia mai; gli errori hanno data.code (code_taken, invalid_date, max_uses_below_taken, code_has_uses, ...)
// e data.message già in italiano.
export const listSignupCodes = (page) => request(`admin/signup_codes.php?page=${page}`);

// Il codice con i suoi iscritti, a pagine di 20
export const getSignupCode = (id, page) => request(`admin/signup_codes.php?id=${id}&page=${page}`);

export const createSignupCode = (fields) => post('admin/signup_codes.php', { action: 'create', ...fields });
export const updateSignupCode = (id, fields) => post('admin/signup_codes.php', { action: 'update', id, ...fields });
export const deleteSignupCode = (id) => post('admin/signup_codes.php', { action: 'delete', id });
