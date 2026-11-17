import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';

// Esportazione dei dati: scarica il JSON completo generato dal server (profilo, schede, storico e serie,
// misure, gamification, dispositivi e consensi). Usata da Account e dalla schermata di conferma dell'email.
// notify(message, severity) mostra l'esito. download() ritorna true se il download è partito.
export default function useDataExport(username, notify) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}api/user/export.php`, { method: 'GET', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || t('account.export.failed'));

      const { success, ...dataToExport } = data; // eslint-disable-line no-unused-vars
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dati_liftindex_${username || 'utente'}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify(t('account.export.done'), 'success');
      return true;
    } catch (error) {
      console.error('Errore nell\'esportazione dei dati:', error);
      notify(t('account.export.error'), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { exporting: loading, download };
}
