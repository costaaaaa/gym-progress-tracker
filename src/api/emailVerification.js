import { post } from './exercises';

// Conferma dell'email (backend/api/user/): codice di 6 cifre, reinvio, cambio di indirizzo.
// Ogni funzione ritorna { ok, status, data } e non lancia mai; gli errori hanno data.code
// (email_code_wrong con attempts_left, email_code_expired, email_resend_wait con retry_after, ...).
export const confirmEmailCode = (code) => post('user/confirm_email.php', { code });
export const resendEmailCode = () => post('user/resend_email_code.php');
export const changeEmail = (email, password) => post('user/change_email.php', { email, password });
export const cancelEmailChange = () => post('user/cancel_email_change.php');
