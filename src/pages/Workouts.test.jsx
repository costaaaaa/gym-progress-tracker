// Gli indirizzi di prima, quando Schede e Storico erano due schede della stessa pagina, portano alle pagine nuove.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Workouts from './Workouts';

// Le pagine vere sono altrove: qui conta dove si arriva
const Where = () => {
  const { pathname, search, state } = useLocation();
  return <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state)}`}</p>;
};

const open = (entry) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/workouts" element={<Workouts />} />
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
});
