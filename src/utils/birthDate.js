import { isValid, subYears, startOfToday } from 'date-fns';

// Limiti della data di nascita, gli stessi del server (birth_date_error() in backend/config/api_helpers.php):
// non più vecchia di 100 anni (esattamente 100 passa) e almeno 14 anni.
export const oldestBirthDate = () => subYears(startOfToday(), 100);
export const youngestBirthDate = () => subYears(startOfToday(), 14);

// Data scritta a metà o impossibile (Invalid Date), oppure oltre il limite dei 100 anni
export const isInvalidBirthDate = (date) => !isValid(date) || date < oldestBirthDate();
