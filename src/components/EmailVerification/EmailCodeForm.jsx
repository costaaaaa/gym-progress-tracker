import { useState, useEffect, useId, useRef } from 'react';
import { Box, Button, FormHelperText, TextField, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { confirmEmailCode, resendEmailCode } from '../../api/emailVerification';
import ButtonSpinner from '../ButtonSpinner';

// Attesa fra due invii: il server ne accetta uno ogni 2 minuti
const RESEND_WAIT_SECONDS = 120;
const CODE_LENGTH = 6;

// «1:30»: minuti e secondi, per l'attesa del nuovo codice
export const formatWait = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Secondi che mancano a `until` (ms), 0 se è passato. Il conto si aggiorna una volta al secondo.
function useSecondsUntil(until) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return undefined;
    setNow(Date.now());
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

// Campo del codice di 6 cifre arrivato per email, con «Conferma» e «Invia un nuovo codice». Lo stesso
// componente sta nella finestra (EmailConfirmDialog) e nella schermata di blocco (EmailBlockedScreen).
// `actions` sono bottoni in più, accanto agli altri (es. «Più tardi»).
// onConfirmed({ email, changed }) parte a conferma avvenuta e stato già riletto.
const EmailCodeForm = ({ onConfirmed, actions, autoFocus = false }) => {
  const { t } = useTranslation();
  const { emailState, refreshEmailState } = useAuth();
  const id = useId();
  const hintId = `${id}-hint`;
  const codeErrorId = `${id}-error`;

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState(null); // 'wait' | 'network' | testo del server
  const [resendUntil, setResendUntil] = useState(0);
  const [announce, setAnnounce] = useState('');
  const waitLeft = useSecondsUntil(resendUntil);
  const inputRef = useRef(null);

  const pendingEmail = emailState?.pendingEmail ?? null;
  const sentTo = pendingEmail ?? emailState?.email ?? '';

  const done = async (email, changed) => {
    await refreshEmailState();
    setAnnounce(t('emailconfirm.done'));
    onConfirmed?.({ email, changed });
  };

  const onCodeChange = (event) => {
    // Incollare «123 456» o «123-456» funziona: restano solo le cifre
    setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
    setCodeError(null);
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (confirming) return;
    if (code.length !== CODE_LENGTH) {
      setCodeError({ code: 'email_code_format' });
      inputRef.current?.focus();
      return;
    }
    setConfirming(true);
    setCodeError(null);
    const res = await confirmEmailCode(code);
    setConfirming(false);
    if (res.ok) {
      await done(res.data.email ?? sentTo, pendingEmail !== null);
    } else if (res.data?.code === 'email_already_verified') {
      await done(sentTo, false);
    } else {
      setCodeError({
        code: res.status === 0 ? 'network' : res.data?.code,
        left: res.data?.attempts_left,
        seconds: res.data?.retry_after,
        message: res.data?.message,
      });
      // Il campo resta lo stesso durante l'invio (sola lettura, non disabilitato), ma il focus era sul bottone
      inputRef.current?.focus();
    }
  };

  const handleResend = async () => {
    if (resending || waitLeft > 0) return;
    setResending(true);
    setResendError(null);
    setAnnounce('');
    const res = await resendEmailCode();
    setResending(false);
    if (res.ok) {
      setResendUntil(Date.now() + RESEND_WAIT_SECONDS * 1000);
      setAnnounce(t('emailconfirm.resent'));
    } else if (res.data?.code === 'email_already_verified') {
      await done(sentTo, false);
    } else if (res.data?.code === 'email_resend_wait') {
      setResendUntil(Date.now() + (res.data.retry_after ?? RESEND_WAIT_SECONDS) * 1000);
      setResendError('wait');
    } else {
      setResendError(res.status === 0 ? 'network' : (res.data?.message || 'generic'));
    }
  };

  const codeErrorText = (() => {
    if (!codeError) return '';
    switch (codeError.code) {
      case 'email_code_format': return t('emailconfirm.error_format');
      case 'email_code_wrong':
        if (codeError.left > 0) return t('emailconfirm.error_wrong', { left: codeError.left });
        // «Non vale più» solo se il server dice che i tentativi sono finiti (0); senza numero, il testo semplice
        return codeError.left === 0 ? t('emailconfirm.error_wrong_last') : t('emailconfirm.error_wrong_plain');
      case 'email_code_expired': return t('emailconfirm.error_expired');
      case 'rate_limited': return t('emailconfirm.error_too_many', { time: formatWait(codeError.seconds ?? 0) });
      case 'email_taken': return t('emailconfirm.error_taken_late');
      case 'network': return t('emailconfirm.error_network');
      default: return codeError.message || t('emailconfirm.error_generic');
    }
  })();

  const resendErrorText = (() => {
    if (resendError === 'wait') return waitLeft > 0 ? t('emailconfirm.error_wait', { time: formatWait(waitLeft) }) : '';
    if (resendError === 'network') return t('emailconfirm.error_network');
    if (resendError === 'generic') return t('emailconfirm.error_generic');
    return resendError || '';
  })();

  return (
    <Box component="form" onSubmit={handleConfirm} noValidate>
      {sentTo && (
        <Typography sx={{ mb: 2 }}>{t('emailconfirm.sent_to', { email: sentTo })}</Typography>
      )}
      <TextField
        label={t('emailconfirm.code_label')}
        value={code}
        onChange={onCodeChange}
        autoFocus={autoFocus}
        fullWidth
        required
        error={Boolean(codeErrorText)}
        inputRef={inputRef}
        sx={{ '& input': { letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' } }}
        inputProps={{
          inputMode: 'numeric',
          readOnly: confirming,
          autoComplete: 'one-time-code',
          'aria-describedby': [hintId, codeErrorText ? codeErrorId : ''].filter(Boolean).join(' '),
          'aria-invalid': codeErrorText ? 'true' : undefined,
        }}
      />
      <FormHelperText id={hintId} sx={{ mx: 0, fontSize: 16 }}>{t('emailconfirm.code_help')}</FormHelperText>
      {codeErrorText && (
        <FormHelperText id={codeErrorId} error role="alert" sx={{ mx: 0, fontSize: 16 }}>{codeErrorText}</FormHelperText>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
        <Button type="submit" variant="contained" disabled={confirming} sx={{ minHeight: 44, fontSize: 16 }}
          startIcon={confirming ? <ButtonSpinner size={16} /> : undefined}>
          {confirming ? t('emailconfirm.confirming') : t('emailconfirm.confirm')}
        </Button>
        <Button type="button" variant="outlined" onClick={handleResend} disabled={resending || waitLeft > 0} sx={{ minHeight: 44, fontSize: 16 }}>
          {waitLeft > 0 ? t('emailconfirm.resend_wait', { time: formatWait(waitLeft) }) : t('emailconfirm.resend')}
        </Button>
        {actions}
      </Box>
      {resendErrorText && (
        <FormHelperText error role="alert" sx={{ mx: 0, mt: 1, fontSize: 16 }}>{resendErrorText}</FormHelperText>
      )}
      <Box role="status" aria-live="polite" sx={announce ? { mt: 1, fontSize: 16, color: 'text.secondary' } : visuallyHidden}>
        {announce}
      </Box>
    </Box>
  );
};

export default EmailCodeForm;
