import i18n from '../i18n';

// Regole della password, identiche a backend/lib/password_policy.php e alla mobile.
// Ritorna null se valida, altrimenti il messaggio da mostrare.
export const validatePassword = (pass) => {
  if (pass.length < 8) return i18n.t('password.min_length');
  if (pass.length > 72) return i18n.t('password.max_length');
  if (!/[A-Z]/.test(pass)) return i18n.t('password.uppercase');
  if (!/[a-z]/.test(pass)) return i18n.t('password.lowercase');
  if (!/[0-9]/.test(pass)) return i18n.t('password.number');
  if (!/[^A-Za-z0-9]/.test(pass)) return i18n.t('password.special');
  return null;
};
