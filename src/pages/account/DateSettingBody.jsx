import LabeledDatePicker from '../../components/LabeledDatePicker';
import DateLocalization from '../../i18n/DateLocalization';
import SettingOutcome from './SettingOutcome';

// MUI disegna etichetta e riga d'aiuto del campo più piccole di 16 px: qui si portano a 16
const READABLE_TEXT = { '& .MuiInputLabel-root, & .MuiFormHelperText-root': { fontSize: 16 } };

// Corpo della finestra di un campo con la data (data di nascita, inizio allenamento): il campo col suo aiuto e sotto
// l'esito di un rifiuto del server (`outcomeError`). `error` è l'errore di validazione, scritto al posto dell'aiuto e
// letto col campo; `inputProps` e le altre proprietà (limiti, viste, formato) vanno al selettore. Il salvataggio sta nel
// piede della finestra (SettingDialog con onSave).
const DateSettingBody = ({ label, value, onChange, help, error, outcomeError, inputRef, inputProps, ...picker }) => (
  <>
    <DateLocalization>
      <LabeledDatePicker
        label={label}
        value={value}
        onChange={onChange}
        slotProps={{
          textField: {
            fullWidth: true,
            size: 'small',
            sx: READABLE_TEXT,
            // undefined (non false) lascia a MUI X il suo errore di validazione (data fuori da minDate/maxDate)
            error: error ? true : undefined,
            inputRef,
            // MUI X ignora autoComplete di textField e lo mette a "off": passa solo da inputProps
            ...(inputProps && { inputProps }),
            helperText: error || help,
          },
        }}
        {...picker}
      />
    </DateLocalization>
    <SettingOutcome error={outcomeError} />
  </>
);

export default DateSettingBody;
