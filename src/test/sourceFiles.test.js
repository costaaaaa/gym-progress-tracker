import { describe, it, expect } from 'vitest';
import { sourceOffenders } from './sourceFiles';

describe('sourceOffenders', () => {
  it('scende nelle sottocartelle di src/ e salta i file esclusi', () => {
    // Una scansione che "trova" in ogni file il suo stesso percorso: ogni file letto compare nel risultato
    const reportPath = (text, rel) => [rel];
    expect(sourceOffenders(reportPath, [])).toContain('theme/radius.js: theme/radius.js');
    expect(sourceOffenders(reportPath, ['theme/radius.js'])).not.toContain('theme/radius.js: theme/radius.js');
  });
});
