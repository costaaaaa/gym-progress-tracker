import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Account from '../pages/Account';
import AccountList from '../pages/account/AccountList';
import ProfilePage from '../pages/account/ProfilePage';
import PreferencesPage from '../pages/account/PreferencesPage';
import ModulesPage from '../pages/account/ModulesPage';
import TierPage from '../pages/account/TierPage';
import DataPage from '../pages/account/DataPage';
import SecurityPage from '../pages/account/SecurityPage';
import { ThemeModeProvider } from '../context/ThemeModeContext';

// Le rotte dell'Account come stanno in App.jsx (lì sono caricate a richiesta): la cornice con le sette pagine
const Tree = ({ path }) => (
  <ThemeModeProvider>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account" element={<Account />}>
          <Route index element={<AccountList />} />
          <Route path="profilo" element={<ProfilePage />} />
          <Route path="preferenze" element={<PreferencesPage />} />
          <Route path="moduli" element={<ModulesPage />} />
          <Route path="piano" element={<TierPage />} />
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
