// L'apertura della Home nei quattro stati: testi, bottoni, dove portano, rosso o neutro.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import HomeOpening from './HomeOpening';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import i18n from '../../i18n';
import { mediaStyle } from '../../test/mediaStyle';

const NEXT = { id: 7, name: 'Giorno B · Pull', exercises: 6 };
const props = {
  state: 'todo', name: 'mario88', nextDay: NEXT, draftDayName: null, todayRecord: null, weightUnit: 'kg',
  week: { workouts: 2, goal: 4, days: [true, false, true, false, false, false, false], todayIdx: 3 },
};
const Where = () => {
  const { pathname, state } = useLocation();
  return <p data-testid="where">{pathname}{state ? JSON.stringify(state) : ''}</p>;
};
const showWeek = (extra, week) => show({ ...extra, week: { ...props.week, ...week } });
const show = (extra) => render(
  <MemoryRouter>
    <ThemeModeProvider>
      <Routes>
        <Route path="/" element={<HomeOpening {...props} {...extra} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </ThemeModeProvider>
  </MemoryRouter>,
);
const bg = (el) => getComputedStyle(el).backgroundColor;
const RED = 'rgb(213, 0, 0)';

afterEach(() => act(() => i18n.changeLanguage('it')));

describe('stato «todo» (rosso)', () => {
  it('un solo h1 con il saluto; frase del giorno e della settimana', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ciao, mario88');
    expect(screen.getByText('Oggi tocca a Giorno B · Pull. Questa settimana sei a 2 allenamenti su 4.')).toBeTruthy();
  });

  it('campo rosso con testo bianco e angoli in basso di 28 px; titolo del giorno e conteggio senza durata', () => {
    show();
    const field = screen.getByRole('heading', { level: 1 }).closest('[data-red-field]');
    expect(bg(field)).toBe(RED);
    expect(getComputedStyle(field).color).toBe('rgb(255, 255, 255)');
    expect(mediaStyle(field, 0)['border-radius']).toBe('0 0 28px 28px');
    expect(mediaStyle(field, 900)['border-radius']).toBe('28px');
    expect(within(field).getByText('Oggi')).toBeTruthy();
    expect(within(field).getByText('Giorno B · Pull')).toBeTruthy();
    expect(within(field).getByText('6 esercizi')).toBeTruthy();
    expect(field.textContent).not.toMatch(/circa|min/);
  });

  it('«Inizia» è un bottone bianco con testo rosso e porta al Focus con il giorno proposto nello stato', () => {
    show();
    const link = screen.getByRole('link', { name: 'Inizia' });
    expect(bg(link)).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(link).color).toBe(RED);
    expect(link.getAttribute('href')).toBe('/focus');
    act(() => link.click());
    expect(screen.getByTestId('where').textContent).toBe('/focus{"suggestedDayId":7}');
  });

  it('la settimana: etichetta, «2 di 4 allenamenti» e i sette giorni sul rosso', () => {
    show();
    const field = screen.getByRole('heading', { level: 1 }).closest('[data-red-field]');
    expect(within(field).getByText('Settimana')).toBeTruthy();
    expect(within(field).getByText('2 di 4 allenamenti')).toBeTruthy();
    expect(field.querySelectorAll('[data-circle]').length).toBe(7);
  });

  it('senza giorno proposto: solo la frase della settimana e il bottone, niente titolo né conteggio', () => {
    show({ nextDay: null });
    expect(screen.getByText('Questa settimana sei a 2 allenamenti su 4.')).toBeTruthy();
    expect(screen.queryByText(/Oggi tocca a/)).toBeNull();
    expect(screen.queryByText(/esercizi/)).toBeNull();
    const link = screen.getByRole('link', { name: 'Inizia' });
    act(() => link.click());
    expect(screen.getByTestId('where').textContent).toBe('/focus');
  });

  it.each([[0, 'Questa settimana sei a 0 allenamenti su 3.'], [1, 'Questa settimana sei a 1 allenamento su 3.'], [2, 'Questa settimana sei a 2 allenamenti su 3.']])(
    'plurali: %i allenamenti', (count, text) => {
      showWeek({ nextDay: null }, { workouts: count, goal: 3 });
      expect(screen.getByText(text)).toBeTruthy();
    },
  );

  it('senza giorno proposto né obiettivo non c\'è nessuna frase: niente paragrafo vuoto', () => {
    showWeek({ nextDay: null }, { goal: undefined });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.nextElementSibling.tagName).not.toBe('P');
    [...h1.closest('[data-red-field]').querySelectorAll('p')].forEach((p) => expect(p.textContent.trim()).not.toBe(''));
    expect(screen.getByRole('link', { name: 'Inizia' })).toBeTruthy();
  });

  it('un solo esercizio: «1 esercizio»', () => {
    show({ nextDay: { ...NEXT, exercises: 1 } });
    expect(screen.getByText('1 esercizio')).toBeTruthy();
  });

  it('senza obiettivo della settimana niente frase né conteggio della settimana', () => {
    showWeek({}, { goal: undefined });
    expect(screen.getByText('Oggi tocca a Giorno B · Pull.')).toBeTruthy();
    expect(screen.queryByText(/di \d+ allenament/)).toBeNull();
  });

  it('in inglese i testi sono in inglese', async () => {
    await act(() => i18n.changeLanguage('en'));
    show();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hi, mario88');
    expect(screen.getByText('Up today: Giorno B · Pull. This week so far: 2 workouts out of 4.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start' })).toBeTruthy();
  });
});

describe('stato «resume» (rosso)', () => {
  it('«Hai un allenamento a metà» con il giorno della bozza; «Riprendi» porta a /focus senza stato', () => {
    show({ state: 'resume', draftDayName: 'Giorno A · Push' });
    expect(screen.getByText('Hai un allenamento a metà: Giorno A · Push.')).toBeTruthy();
    expect(screen.queryByText(/serie \d+ di/i)).toBeNull();
    const field = screen.getByRole('heading', { level: 1 }).closest('[data-red-field]');
    expect(bg(field)).toBe(RED);
    expect(within(field).getByText('Giorno A · Push')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Riprendi' });
    act(() => link.click());
    expect(screen.getByTestId('where').textContent).toBe('/focus');
  });
});

describe('stato «done» (neutro)', () => {
  const record = { day_name: 'Giorno B · Pull', duration_seconds: 3480, exercises: [{ name: 'Panca', sets: [{ weight: 100, reps: 10 }] }] };

  it('niente campo rosso; saluto e «Fatto per oggi.» con la settimana', () => {
    show({ state: 'done', todayRecord: record });
    expect(screen.getByRole('heading', { level: 1 }).closest('[data-red-field]')).toBeNull();
    expect(screen.getByText('Fatto per oggi. Questa settimana sei a 2 allenamenti su 4.')).toBeTruthy();
  });

  it('card: Oggi, titolo, «Completato», durata e volume, «Vedi allenamento» verso lo Storico, prossima seduta', () => {
    show({ state: 'done', todayRecord: record });
    expect(screen.getByText('Oggi')).toBeTruthy();
    expect(screen.getByText('Giorno B · Pull', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Completato')).toBeTruthy();
    expect(screen.getByText('58 min · 1.000 kg di volume')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Vedi allenamento' });
    expect(link.getAttribute('href')).toBe('/storico');
    expect(screen.getByText('Prossima seduta: Giorno B · Pull')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Inizia' })).toBeNull();
  });

  it('senza nome del giorno: «Allenamento di oggi»; senza giorno proposto niente «Prossima seduta»', () => {
    show({ state: 'done', todayRecord: { ...record, day_name: null }, nextDay: null });
    expect(screen.getByText('Allenamento di oggi')).toBeTruthy();
    expect(screen.queryByText(/Prossima seduta/)).toBeNull();
  });

  it('senza durata resta il solo volume', () => {
    show({ state: 'done', todayRecord: { ...record, duration_seconds: null } });
    expect(screen.getByText('1.000 kg di volume')).toBeTruthy();
  });

  it('la card contiene anche la settimana, sotto un bordo, con i giorni sul neutro', () => {
    show({ state: 'done', todayRecord: record });
    const card = screen.getByText('Completato').closest('[data-card]');
    expect(within(card).getByText('Settimana')).toBeTruthy();
    expect(within(card).getByText('2 di 4 allenamenti')).toBeTruthy();
    expect(card.querySelectorAll('[data-circle]').length).toBe(7);
  });
});

describe('stato «goal» (neutro)', () => {
  it('frase dell\'obiettivo raggiunto, a obiettivo pari', () => {
    showWeek({ state: 'goal' }, { workouts: 4, goal: 4 });
    expect(screen.getByText('Obiettivo della settimana raggiunto: 4 allenamenti su 4.')).toBeTruthy();
  });
  it('oltre l\'obiettivo il conteggio resta quello vero', () => {
    showWeek({ state: 'goal' }, { workouts: 5, goal: 4 });
    expect(screen.getByText('Obiettivo della settimana raggiunto: 5 allenamenti su 4.')).toBeTruthy();
    expect(screen.getByText('5 di 4 allenamenti')).toBeTruthy();
  });
  it('un solo allenamento su uno: singolare', () => {
    showWeek({ state: 'goal' }, { workouts: 1, goal: 1 });
    expect(screen.getByText('Obiettivo della settimana raggiunto: 1 allenamento su 1.')).toBeTruthy();
    expect(screen.getByText('1 di 1 allenamento')).toBeTruthy();
  });

  it('card «Prossima seduta» con il giorno, il conteggio e «Inizia» a contorno col giorno scelto', () => {
    showWeek({ state: 'goal' }, { workouts: 4, goal: 4 });
    expect(screen.getByRole('heading', { level: 1 }).closest('[data-red-field]')).toBeNull();
    expect(screen.getByText('Prossima seduta')).toBeTruthy();
    expect(screen.getByText('Giorno B · Pull')).toBeTruthy();
    expect(screen.getByText('6 esercizi')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Inizia' });
    expect(getComputedStyle(link).backgroundColor).not.toBe('rgb(255, 255, 255)');
    act(() => link.click());
    expect(screen.getByTestId('where').textContent).toBe('/focus{"suggestedDayId":7}');
  });

  it('senza giorno proposto solo il bottone «Inizia»', () => {
    showWeek({ state: 'goal', nextDay: null }, { workouts: 4, goal: 4 });
    expect(screen.queryByText('Prossima seduta')).toBeNull();
    expect(screen.getByRole('link', { name: 'Inizia' })).toBeTruthy();
  });

  it('la settimana sta nella stessa card', () => {
    showWeek({ state: 'goal' }, { workouts: 4, goal: 4 });
    const card = screen.getByText('Prossima seduta').closest('[data-card]');
    expect(within(card).getByText('4 di 4 allenamenti')).toBeTruthy();
  });
});
