import { API_BASE_URL } from '../config';

export const isSuccess = (data) => data?.success === true;

// Lettura di un endpoint del sito (`path` relativo a API_BASE_URL) come JSON, o null se non è andata bene.
// `accept` decide se il corpo è buono; di partenza ogni corpo lo è. Un errore di rete lancia: lo gestisce il chiamante.
export const readJson = async (path, accept = () => true) => {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) return null;
  const data = await response.json();
  return accept(data) ? data : null;
};
