import { achievementLabel } from '../../i18n/labels';

// Testo dell'avviso dopo il salvataggio: i traguardi appena sbloccati ([{ key, label }] dal server) con il nome nella
// lingua dell'app, separati da virgola. Per una chiave sconosciuta al client resta il label del server.
export const unlockedAchievementsText = (unlocked, weightUnit) => unlocked.map((a) => achievementLabel(a.key, a.label, weightUnit)).join(', ');
