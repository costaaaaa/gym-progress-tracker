import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';

// La scheda attiva dell'utente, per «Registra allenamento passato» (si registra solo con una scheda attiva).
// `planLoaded`: la lettura è finita; `planReadFailed`: non è riuscita, quindi non si sa se la scheda manca.
export default function useActivePlan() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [activePlan, setActivePlan] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [planReadFailed, setPlanReadFailed] = useState(false);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    const read = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}api/workout/read_plans.php`);
        const data = await response.json();
        if (data.records) {
          setActivePlan(data.records.find((plan) => plan.is_active) || null);
        } else {
          setPlanReadFailed(true);
        }
      } catch (error) {
        console.error('Error fetching active plan:', error);
        setPlanReadFailed(true);
      } finally {
        setPlanLoaded(true);
      }
    };
    read();
  }, [isLoggedIn, authLoading]);

  return { activePlan, planLoaded, planReadFailed };
}
