import { createElement } from 'react';

// jsdom non sa scrivere un campo data «a metà» (MUI X lo sa fare solo con la tastiera vera): il campo vero resta, ma
// se ne tiene l'onChange per consegnargli un Invalid Date, come fa MUI X quando una sezione è vuota o impossibile.
// Uso, in testa al file di test: vi.mock('../components/LabeledDatePicker', async (importOriginal) => (await import('../test/birthFieldSpy')).spyOnBirthField(await importOriginal()));
export const birthFieldChange = { current: null };

export const spyOnBirthField = (module) => ({
  default: (props) => {
    if (props.label === 'Data di nascita') birthFieldChange.current = props.onChange;
    return createElement(module.default, props);
  },
});
