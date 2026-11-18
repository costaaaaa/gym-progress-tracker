import { describe, it, expect } from 'vitest';
import i18n from './index';
import { achievementCatalog } from '../utils/gamificationLevels';
import { achievementLabel } from './labels';

// Nomi approvati dei 19 traguardi (stessi di backend/lang). achievementCatalog in utils/gamificationLevels.js è il catalogo
// condiviso con un altro client: achievementLabel (labels.js) ne legge le soglie di forza, qui serve a controllare le chiavi
// e i nomi italiani
const EN = {
  sessions_10: 'First 10 sessions', sessions_50: '50 sessions', sessions_100: 'Centurion', sessions_250: '250 sessions',
  tonnage_auto: '1.5 t — a car', tonnage_elephant: '6 t — an elephant', tonnage_bus: '15 t — a city bus',
  tonnage_tank: '60 t — a battle tank', tonnage_whale: '150 t — a blue whale', tonnage_iss: '420 t — the Space Station',
  tonnage_shuttle: '2,000 t — a Space Shuttle', tonnage_eiffel: '7,300 t — the Eiffel Tower',
  strength_60: '60 kg on one exercise', strength_100: '100 kg on one exercise', strength_140: '140 kg on one exercise',
  streak_4: '4 weeks in a row', streak_8: '8 weeks in a row', streak_12: '12 weeks in a row', streak_24: '24 weeks in a row',
};

describe('nomi dei traguardi', () => {
  it('il catalogo ha 19 traguardi, tutti con il nome inglese approvato', () => {
    expect(achievementCatalog.map((a) => a.key)).toEqual(Object.keys(EN));
  });
  it('in italiano il nome è quello del catalogo', async () => {
    await i18n.changeLanguage('it');
    for (const { key, label } of achievementCatalog) expect(achievementLabel(key)).toBe(label);
  });
  it('in inglese il nome è quello approvato', async () => {
    await i18n.changeLanguage('en');
    for (const { key } of achievementCatalog) expect(achievementLabel(key)).toBe(EN[key]);
  });
  it('una chiave sconosciuta resta la chiave', async () => {
    const key = 'nope_1';
    expect(i18n.t(`achievement.${key}`, { defaultValue: key })).toBe(key);
  });
});
