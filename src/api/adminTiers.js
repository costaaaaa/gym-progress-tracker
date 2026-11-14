import { post, request } from './exercises';

// Livello degli utenti lato admin (backend/api/admin/tiers.php): ricerca e assegnazione.
export const searchAdminTiers = (q) => request(`admin/tiers.php?q=${encodeURIComponent(q)}`);

// lastDay: ultimo giorno valido (AAAA-MM-GG, ora italiana) o null se non scade. Il server calcola le scadenze.
export const setAdminTier = (id, tier, lastDay) =>
  post('admin/tiers.php', { action: 'set_tier', id, tier, last_day: lastDay });
