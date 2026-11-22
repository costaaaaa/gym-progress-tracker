import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveSettings } from './saveSettings';
import { json } from '../../test/dom';

afterEach(() => { vi.unstubAllGlobals(); });

describe('saveSettings', () => {
  it('invia solo i campi da cambiare a update_settings.php, con i cookie, e dà la risposta del server', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ success: true, age: 30 })));
    vi.stubGlobal('fetch', fetchMock);
    const data = await saveSettings({ locale: 'en' });
    expect(data).toEqual({ success: true, age: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/backend/api/user/update_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{"locale":"en"}',
    });
  });

  it('se il server rifiuta lancia un errore con il suo messaggio', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: false, message: 'Unità non valida' }, 400))));
    await expect(saveSettings({ weight_unit: 'st' })).rejects.toThrow('Unità non valida');
  });

  it('se la rete non risponde l\'errore della fetch arriva a chi chiama', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('rete'))));
    await expect(saveSettings({ locale: 'it' })).rejects.toThrow('rete');
  });
});
