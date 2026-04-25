/**
 * Utility per il feedback aptico (vibrazione)
 */
export const vibrate = (pattern = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration API error:', e);
    }
  }
};

export const hapticFeedback = {
  light: () => vibrate(30),
  medium: () => vibrate(50),
  success: () => vibrate([50, 30, 50]),
  error: () => vibrate([100, 50, 100]),
  warning: () => vibrate([50, 100]),
};
