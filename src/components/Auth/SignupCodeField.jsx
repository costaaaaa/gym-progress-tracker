import { Button, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LINK_BUTTON } from '../../utils/buttonStyles';

// Riga «Hai un codice?» e, aperta, il campo «Codice di registrazione». Lo stato è di useSignupCode.
const SignupCodeField = ({ signup, fieldRef }) => {
  const { t } = useTranslation();
  return (
    <>
      <Button
        onClick={signup.toggle}
        aria-expanded={signup.open}
        aria-controls={signup.open ? 'signupCode' : undefined}
        sx={{ ...LINK_BUTTON, mt: 1 }}
      >
        {t('register.code_toggle')}
      </Button>
      {signup.open && (
        <TextField
          margin="dense"
          fullWidth
          id="signupCode"
          inputRef={fieldRef('signupCode')}
          label={t('register.code_label')}
          name="signupCode"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={signup.value}
          onChange={signup.change}
          error={Boolean(signup.error)}
          helperText={signup.error || signup.note}
        />
      )}
    </>
  );
};

export default SignupCodeField;
