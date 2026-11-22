import { API_BASE_URL } from '../../config';

// L'unica richiesta di salvataggio verso update_settings.php: profilo, lingua, unità di peso e obiettivo settimanale la
// usano tutti. `patch` sono solo i campi da cambiare; ritorna la risposta del server (con i valori ricalcolati) e, se il
// server rifiuta, lancia un Error con il suo messaggio.
export async function saveSettings(patch) {
  const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}
