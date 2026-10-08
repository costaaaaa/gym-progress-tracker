import i18n from '../i18n';

// Il backend conta byte UTF-8 (bcrypt legge solo i primi 72): stessa misura qui, altrimenti
// una password con accenti o emoji passa il client e viene rifiutata dal server.
const utf8Length = (s) => {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
};

// Regole della password, identiche a backend/lib/password_policy.php e alla mobile.
// Ritorna null se valida, altrimenti il messaggio da mostrare.
export const validatePassword = (pass) => {
  if (utf8Length(pass) < 8) return i18n.t('password.min_length');
  if (utf8Length(pass) > 72) return i18n.t('password.max_length');
  if (!/[A-Z]/.test(pass)) return i18n.t('password.uppercase');
  if (!/[a-z]/.test(pass)) return i18n.t('password.lowercase');
  if (!/[0-9]/.test(pass)) return i18n.t('password.number');
  if (!/[^A-Za-z0-9]/.test(pass)) return i18n.t('password.special');
  return null;
};
