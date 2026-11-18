import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShareConsentDialog from './ShareConsentDialog';

const mount = (props = {}) => render(<ShareConsentDialog open groupName="G" username="u" loading={false} onClose={() => {}} onConfirm={() => {}} {...props} />);

describe('consenso all\'ingresso in un gruppo: unità del volume', () => {
  it('in kg il testo è quello di sempre', () => {
    mount();
    expect(screen.getByText('allenamenti e volume (kg) della settimana')).toBeTruthy();
  });

  it('in lb dice libbre', () => {
    mount({ weightUnit: 'lb' });
    expect(screen.getByText('allenamenti e volume (lb) della settimana')).toBeTruthy();
  });
});
