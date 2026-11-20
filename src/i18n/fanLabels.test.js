// I testi corti sotto i tondi del ventaglio stanno su una riga (`nowrap`) dentro un bersaglio largo 56 px: oltre 9
// caratteri (a 12 px) sbordano e a 320 px toccano il vicino. Chi aggiunge una voce scrive un testo corto davvero.
import { describe, it, expect } from 'vitest';
import it_ from './it.json';
import en from './en.json';

describe.each([['it', it_], ['en', en]])('testi corti del ventaglio (%s)', (_, messages) => {
  const shorts = Object.entries(messages).filter(([key]) => /^nav\.center\..*_short$/.test(key));

  it('ci sono e non superano i 9 caratteri', () => {
    expect(shorts.length).toBeGreaterThan(0);
    for (const [key, text] of shorts) expect(text.length, key).toBeLessThanOrEqual(9);
  });
});
