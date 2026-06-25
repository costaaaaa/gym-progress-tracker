import confetti from 'canvas-confetti';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const celebrate = (opts = {}) => {
  if (reducedMotion()) return;
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, ...opts });
};

export const celebratePR = () =>
  celebrate({ particleCount: 60, spread: 50, colors: ['#ffa726', '#ff7043', '#ffca28'] });

export const celebrateStreak = () =>
  celebrate({ particleCount: 160, spread: 90, origin: { y: 0.5 }, colors: ['#ef5350', '#ff7043', '#ffa726', '#66bb6a'] });
