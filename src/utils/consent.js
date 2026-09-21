import { API_BASE_URL } from '../config';

// Stato dei consensi dell'utente: { terms: {granted, ...}, health_data: {granted, ...} }
export const getConsents = async () => {
  const response = await fetch(`${API_BASE_URL}api/user/consent.php`, { credentials: 'include' });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Errore nel caricamento dei consensi');
  return data.consents;
};

// action: 'grant' | 'revoke'. Revocare 'health_data' cancella le misure corporee (risposta: deleted_stats).
export const setConsent = async (purpose, action) => {
  const response = await fetch(`${API_BASE_URL}api/user/consent.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ purpose, action }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Operazione non riuscita');
  return data;
};
