// Il guscio delle finestre delle impostazioni: titolo, «Chiudi» e il divieto di chiudere mentre si salva.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import SettingDialog from './SettingDialog';

beforeEach(() => localStorage.setItem('themeMode', 'light'));

const dialogFor = (props = {}) => (
  <ThemeModeProvider>
    <SettingDialog open title="Unità di misura" onClose={() => {}} {...props}><p>Il controllo</p></SettingDialog>
  </ThemeModeProvider>
);
const show = (props = {}) => render(dialogFor(props));

describe('SettingDialog', () => {
  it('è una finestra col titolo come nome, scritto una volta sola, e il suo contenuto', () => {
    show();
    const dialog = screen.getByRole('dialog', { name: 'Unità di misura' });
    expect(within(dialog).getAllByText('Unità di misura')).toHaveLength(1);
    expect(within(dialog).getByText('Il controllo')).toBeTruthy();
  });

  it('«Chiudi» è un pulsante da 16 px e almeno 44 px di altezza', () => {
    show();
    const style = getComputedStyle(screen.getByRole('button', { name: 'Chiudi' }));
    expect(style.fontSize).toBe('16px');
    expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('aperta c\'è; chiusa sparisce dal documento', async () => {
    const view = show();
    expect(screen.getByRole('dialog', { name: 'Unità di misura' })).toBeTruthy();
    view.rerender(dialogFor({ open: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it.each([
    ['«Chiudi»', () => fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))],
    ['Esc', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
    ['il clic fuori', () => fireEvent.click(document.querySelector('.MuiBackdrop-root'))],
  ])('%s chiede di chiudere', (_name, act) => {
    const onClose = vi.fn();
    show({ onClose });
    act();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['«Chiudi»', () => fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))],
    ['Esc', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
    ['il clic fuori', () => fireEvent.click(document.querySelector('.MuiBackdrop-root'))],
  ])('con un salvataggio in corso %s non chiude', (_name, act) => {
    const onClose = vi.fn();
    show({ onClose, saving: true });
    expect(screen.getByRole('button', { name: 'Chiudi' }).disabled).toBe(false); // il pulsante c'è e non è disabilitato
    act();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Chiudi' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Chiudi' }).getAttribute('aria-disabled')).toBe('true');
  });
});
