// Proposta di un modulo sulla Home: una card, «Attiva» o «No, grazie», una risposta alla volta.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import ModuleOffer from './ModuleOffer';
import { renderBlock } from '../../test/homeBlocks';
import { json } from '../../test/dom';
import { unnamedControls } from '../../test/accessibleNames';
import { textBelow } from '../../test/minText';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const MODULES = { body: true, recovery: true, levels: true, groups: false, ai: true };
const setup = (reply) => {
  const onError = vi.fn();
  const updateUser = vi.fn();
  const refreshEmailState = vi.fn();
  auth.value = { user: { modules: MODULES, module_offer: 'groups' }, updateUser, refreshEmailState };
  const answers = [];
  const fake = vi.fn(() => (reply ? Promise.resolve(reply) : new Promise((resolve) => { answers.push(resolve); })));
  vi.stubGlobal('fetch', fake);
  renderBlock(<ModuleOffer moduleKey="groups" onError={onError} />);
  return { onError, updateUser, refreshEmailState, fake, answers };
};
const bodies = (fake) => fake.mock.calls.map(([, init]) => JSON.parse(init.body));

afterEach(() => vi.unstubAllGlobals());

describe('ModuleOffer', () => {
  it('«Prova anche…», il nome del modulo, cosa aggiunge, e i due bottoni con il nome del modulo', () => {
    setup(json({ success: true, modules: MODULES, module_offer: null }));
    expect(screen.getByText('Prova anche…')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Gruppi' })).toBeTruthy();
    expect(screen.getByText('Classifiche con gli amici o con la tua palestra.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attiva Gruppi' }).textContent).toBe('Attiva');
    expect(screen.getByRole('button', { name: /^No, grazie/ }).textContent).toBe('No, grazie');
    expect(unnamedControls()).toEqual([]);
    expect(textBelow(document.body, 13)).toEqual(['Prova anche… (12px)']);
  });

  it('«Attiva»: risponde accepted true, l\'account riceve moduli e proposta della risposta', async () => {
    const { fake, updateUser } = setup(json({ success: true, modules: { ...MODULES, groups: true }, module_offer: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Attiva Gruppi' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ modules: { ...MODULES, groups: true }, module_offer: null }));
    expect(bodies(fake)).toEqual([{ module_offer_answer: { key: 'groups', accepted: true } }]);
  });

  it('«No, grazie»: risponde accepted false, i moduli restano com\'erano', async () => {
    const { fake, updateUser } = setup(json({ success: true, modules: MODULES, module_offer: null }));
    fireEvent.click(screen.getByRole('button', { name: /^No, grazie/ }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ module_offer: null }));
    expect(bodies(fake)).toEqual([{ module_offer_answer: { key: 'groups', accepted: false } }]);
  });

  it('errore (400: la proposta è cambiata): avviso e l\'account si rilegge, la card non cambia', async () => {
    const { onError, refreshEmailState, updateUser } = setup(json({ success: false }, 400));
    fireEvent.click(screen.getByRole('button', { name: 'Attiva Gruppi' }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(refreshEmailState).toHaveBeenCalledTimes(1);
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Attiva Gruppi' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('mentre la richiesta è in volo i bottoni sono disabilitati: un doppio tocco manda una sola risposta', async () => {
    const { fake, answers } = setup(null);
    fireEvent.click(screen.getByRole('button', { name: 'Attiva Gruppi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attiva Gruppi' }));
    fireEvent.click(screen.getByRole('button', { name: /^No, grazie/ }));
    expect(fake).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Attiva Gruppi' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: /^No, grazie/ }).getAttribute('aria-disabled')).toBe('true');
    await act(async () => { answers[0](json({ success: true, modules: MODULES, module_offer: null })); });
  });
});
