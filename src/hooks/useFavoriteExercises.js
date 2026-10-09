import { useCallback, useState } from 'react';

const STORAGE_KEY = 'liftindex.progress.favorites';

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

// Esercizi preferiti della vista Progressi, salvati solo su questo dispositivo.
export const useFavoriteExercises = () => {
  const [favorites, setFavorites] = useState(load);

  const toggleFavorite = useCallback((id) => {
    const key = String(id);
    const next = favorites.includes(key) ? favorites.filter((f) => f !== key) : [...favorites, key];
    setFavorites(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage pieno o bloccato: il preferito vale solo per questa sessione
    }
  }, [favorites]);

  return { favorites, toggleFavorite };
};
