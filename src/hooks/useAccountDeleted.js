import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// Dopo l'eliminazione dell'account (DeleteAccountDialog): mostra l'esito con `notify(messaggio, gravità)` e,
// dopo un breve ritardo, esce e porta alla home. Usato da Account e dalla schermata di conferma dell'email.
export default function useAccountDeleted(notify) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  return () => {
    notify(t('account.delete.done'), 'success');
    setTimeout(() => {
      logout();
      navigate('/');
    }, 2000);
  };
}
