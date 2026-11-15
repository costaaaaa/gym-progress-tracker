// Layout avvolge già ogni pagina in un Container (1180px, senza gutter MUI): un secondo Container dentro
// aggiunge 24-32px di gutter e sposta il contenuto. Queste pagine usano un Box con lo stesso padding verticale.
// Fuori elenco di proposito: Admin e JoinGroup (colonna stretta voluta), le fasi del Focus (schermo a parte).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
const PAGES = ['Workouts', 'Groups', 'GroupDetail', 'WorkoutHistory', 'BodyStats', 'Progress'];

describe('nessun Container dentro il Layout', () => {
  it.each(PAGES)('%s non usa <Container>', (page) => {
    expect(readFileSync(join(here, `${page}.jsx`), 'utf8')).not.toMatch(/<Container\b/);
  });
});
