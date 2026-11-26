import confetti from 'canvas-confetti';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// useWorker vale solo quando si crea l'istanza: la funzione predefinita della libreria nasce con il worker, che la CSP
// del sito blocca (worker da blob:) e lascia un errore in console. Quindi si lancia da un'istanza creata senza, una volta sola.
let fire;
const getFire = () => (fire ??= confetti.create(undefined, { useWorker: false, resize: true }));

export const celebrate = (opts = {}) => {
  if (reducedMotion()) return;
  getFire()({ particleCount: 100, spread: 70, origin: { y: 0.6 }, ...opts });
};

export const celebratePR = () =>
  celebrate({ particleCount: 60, spread: 50, colors: ['#ffa726', '#ff7043', '#ffca28'] });

export const celebrateStreak = () =>
  celebrate({ particleCount: 160, spread: 90, origin: { y: 0.5 }, colors: ['#ef5350', '#ff7043', '#ffa726', '#66bb6a'] });

export const celebrateLevelUp = () =>
  celebrate({ particleCount: 200, spread: 120, origin: { y: 0.4 }, colors: ['#1565c0', '#1976d2', '#42a5f5', '#ffd54f', '#fff'] });
