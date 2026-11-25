// Il guscio delle finestre delle impostazioni: titolo, «Chiudi» (o «Annulla» e «Salva» per i campi da confermare) e il
// divieto di chiudere mentre si salva.
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

  it('senza onSave il piede ha solo «Chiudi»: niente «Annulla» né «Salva»', () => {
    show();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Chiudi']);
  });
});

describe('SettingDialog con onSave', () => {
  const saveButton = () => screen.getByRole('button', { name: 'Salva' });

  it('il piede ha «Annulla» e «Salva» (pieno), da 16 px e almeno 44 px di altezza, e non «Chiudi»', () => {
    show({ onSave: () => {} });
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Annulla', 'Salva']);
    expect(saveButton().classList.contains('MuiButton-contained')).toBe(true);
    for (const name of ['Annulla', 'Salva']) {
      const style = getComputedStyle(screen.getByRole('button', { name }));
      expect(style.fontSize).toBe('16px');
      expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('«Salva» chiama onSave, «Annulla» chiede di chiudere', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    show({ onSave, onClose });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('con un salvataggio in corso «Salva» è aria-disabled, non disabled, e non richiama onSave; «Annulla», Esc e il clic fuori non chiudono', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    show({ onSave, onClose, saving: true });
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a salvataggio finito «Salva» non è più aria-disabled', () => {
    show({ onSave: () => {}, saving: false });
    expect(saveButton().getAttribute('aria-disabled')).toBeNull();
  });
});
