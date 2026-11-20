// Gli indirizzi di prima, quando Schede e Storico erano due schede della stessa pagina, portano alle pagine nuove.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LegacyWorkoutsRedirect from './LegacyWorkoutsRedirect';

// Le pagine vere sono altrove: qui conta dove si arriva
const Where = () => {
  const { pathname, search, hash, state } = useLocation();
  return <p data-testid="where">{`${pathname}${search}${hash} ${JSON.stringify(state)}`}</p>;
};

const open = (entry) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/workouts" element={<LegacyWorkoutsRedirect />} />
        <Route path="/workout-plans" element={<LegacyWorkoutsRedirect to="/schede" />} />
        <Route path="/workout-history" element={<LegacyWorkoutsRedirect to="/storico" />} />
        <Route path="/schede" element={<Where />} />
        <Route path="/storico" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId('where').textContent;
};

describe('/workouts', () => {
  it('senza scheda porta alle Schede', () => {
    expect(open('/workouts')).toBe('/schede null');
  });

  it('?tab=plans porta alle Schede', () => {
    expect(open('/workouts?tab=plans')).toBe('/schede null');
  });

  it('?tab=history porta allo Storico', () => {
    expect(open('/workouts?tab=history')).toBe('/storico null');
  });

  it('una scheda sconosciuta porta alle Schede', () => {
    expect(open('/workouts?tab=altro')).toBe('/schede null');
  });

  it('lo stato di navigazione (refreshHistory) arriva con l\'utente', () => {
    expect(open({ pathname: '/workouts', search: '?tab=history', state: { refreshHistory: 5 } })).toBe('/storico {"refreshHistory":5}');
  });

  it('conserva il resto della query e l\'hash, togliendo solo tab', () => {
    expect(open('/workouts?tab=history&x=1#y')).toBe('/storico?x=1#y null');
    expect(open('/workouts?x=1&tab=plans#y')).toBe('/schede?x=1#y null');
  });
});

describe('/workout-plans e /workout-history', () => {
  it('/workout-plans porta alle Schede con query e hash', () => {
    expect(open('/workout-plans?x=1#y')).toBe('/schede?x=1#y null');
  });

  it('/workout-history porta allo Storico con l\'hash', () => {
    expect(open('/workout-history#y')).toBe('/storico#y null');
  });

  it('anche qui passa lo stato di navigazione', () => {
    expect(open({ pathname: '/workout-history', state: { refreshHistory: 7 } })).toBe('/storico {"refreshHistory":7}');
  });
});
