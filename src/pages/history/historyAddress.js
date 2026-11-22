// L'indirizzo dello Storico: ?vista=calendario&mese=2026-11&giorno=2026-11-18. I nomi dei parametri stanno solo qui.
import { isDayKey, isMonthKey } from './calendarMonth';

const VIEW = 'vista';
const MONTH = 'mese';
const DAY = 'giorno';
const CALENDAR_VIEW = 'calendario';

/** Vista ('list' o 'calendar'), mese e giorno dai parametri; un mese o un giorno non validi valgono null. */
export const readAddress = (params) => ({
  view: params.get(VIEW) === CALENDAR_VIEW ? 'calendar' : 'list',
  month: isMonthKey(params.get(MONTH)) ? params.get(MONTH) : null,
  day: isDayKey(params.get(DAY)) ? params.get(DAY) : null,
});

/** I parametri del calendario: sempre la vista, poi mese e giorno quando ci sono, sempre in quest'ordine. */
export const calendarParams = (month, day) => {
  const params = new URLSearchParams({ [VIEW]: CALENDAR_VIEW });
  if (month) params.set(MONTH, month);
  if (day) params.set(DAY, day);
  return params;
};

/** L'elenco è la vista di base: nessun parametro. */
export const listParams = () => new URLSearchParams();
