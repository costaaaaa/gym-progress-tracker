import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Account from '../pages/Account';
import AccountList from '../pages/account/AccountList';
import ProfilePage from '../pages/account/ProfilePage';
import ModulesPage from '../pages/account/ModulesPage';
import DataPage from '../pages/account/DataPage';
import SecurityPage from '../pages/account/SecurityPage';
import { ThemeModeProvider } from '../context/ThemeModeContext';

// Le rotte dell'Account: la cornice con l'elenco e le quattro pagine. Sono una copia di quelle di App.jsx (lì sono caricate a
// richiesta), che serve ai test delle pagine; le rotte vere le prova src/App.test.jsx.
const Tree = ({ path }) => (
  <ThemeModeProvider>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account" element={<Account />}>
          <Route index element={<AccountList />} />
          <Route path="profilo" element={<ProfilePage />} />
          <Route path="moduli" element={<ModulesPage />} />
          <Route path="dati" element={<DataPage />} />
          <Route path="sicurezza" element={<SecurityPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </ThemeModeProvider>
);

// Apre l'Account all'indirizzo dato. `rerenderAccount` ridisegna lo stesso albero (stesso indirizzo): serve a chi cambia
// il contesto finto tra un disegno e l'altro.
export const renderAccount = (path = '/account') => {
  const view = render(<Tree path={path} />);
  return { ...view, rerenderAccount: () => view.rerender(<Tree path={path} />) };
};
