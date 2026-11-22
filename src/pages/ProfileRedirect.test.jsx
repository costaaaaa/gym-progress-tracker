// Gli indirizzi di prima, quando Livelli e Account erano le due schede di /profilo, portano alle pagine nuove:
// segnalibri, email già spedite e `next` del login restano validi. Le ancore della vecchia pagina dell'Account
// (#groups-shown, #groups-list) stanno ora in «Dati e privacy».
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProfileRedirect from './ProfileRedirect';

// Le pagine vere sono altrove: qui conta dove si arriva
const Where = () => {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{`${pathname}${search}${hash}`}</p>;
};

const open = (entry) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/profilo" element={<ProfileRedirect />} />
        <Route path="/account" element={<Where />} />
        <Route path="/account/dati" element={<Where />} />
        <Route path="/livelli" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId('where').textContent;
};

describe('/profilo', () => {
  it('senza scheda porta ai Livelli', () => {
    expect(open('/profilo')).toBe('/livelli');
  });

  it('?tab=summary porta ai Livelli', () => {
    expect(open('/profilo?tab=summary')).toBe('/livelli');
  });

  it('?tab=settings senza ancora porta all\'elenco dell\'Account', () => {
    expect(open('/profilo?tab=settings')).toBe('/account');
  });

  it('?tab=settings con l\'ancora porta a «Dati e privacy», con la stessa ancora', () => {
    expect(open('/profilo?tab=settings#groups-shown')).toBe('/account/dati#groups-shown');
  });

  it('qualunque ancora passa con l\'utente', () => {
    expect(open('/profilo?tab=settings#sezione')).toBe('/account/dati#sezione');
  });

  it('l\'ancora passa anche verso i Livelli', () => {
    expect(open('/profilo#sezione')).toBe('/livelli#sezione');
  });
});
