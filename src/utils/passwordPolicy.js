// Regole della password, identiche a backend/lib/password_policy.php e alla mobile.
// Ritorna null se valida, altrimenti il messaggio da mostrare.
export const validatePassword = (pass) => {
  if (pass.length < 8) return 'La password deve contenere almeno 8 caratteri';
  if (pass.length > 72) return 'La password non può superare i 72 caratteri';
  if (!/[A-Z]/.test(pass)) return 'La password deve contenere almeno una lettera maiuscola';
  if (!/[a-z]/.test(pass)) return 'La password deve contenere almeno una lettera minuscola';
  if (!/[0-9]/.test(pass)) return 'La password deve contenere almeno un numero';
  if (!/[^A-Za-z0-9]/.test(pass)) return 'La password deve contenere almeno un carattere speciale (!@#$%^&*)';
  return null;
};
