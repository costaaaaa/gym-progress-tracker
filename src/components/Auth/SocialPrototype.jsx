// PROTOTIPO (da buttare): dove mettere "Continua con Apple/Google" in login e registrazione (passo 1).
// ?variant=A|B|C su /login e /register, solo in sviluppo. Testi solo in italiano, pulsanti finti.
//   A: modulo classico, poi "oppure", poi Apple e Google
//   B: Apple e Google, poi "oppure con email", poi il modulo
//   C: solo tre pulsanti (Apple, Google, Continua con email); il terzo apre il modulo
// Colori dei pulsanti dalle linee guida dei marchi: Apple nero su chiaro / bianco su scuro,
// Google bianco con bordo #747775 su chiaro / #131314 con bordo #8E918F su scuro.
import { useEffect, useState } from 'react';
import { Box, Button, Divider, Typography, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'react-router-dom';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

const VARIANTS = [
  { key: 'A', name: 'modulo prima' },
  { key: 'B', name: 'social prima' },
  { key: 'C', name: 'solo pulsanti' },
];

export const useVariant = () => {
  const [params] = useSearchParams();
  const key = import.meta.env.DEV ? params.get('variant') : null;
  return VARIANTS.find((v) => v.key === key) || VARIANTS[0];
};

const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const SocialButtons = () => {
  const dark = useTheme().palette.mode === 'dark';
  const base = { textTransform: 'none', fontWeight: 600, fontSize: '1rem', gap: 1.25, boxShadow: 'none' };
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Button
        fullWidth
        disableElevation
        sx={{
          ...base,
          bgcolor: dark ? '#fff' : '#000',
          color: dark ? '#000' : '#fff',
          '&:hover': { bgcolor: dark ? '#e8e8e8' : '#222' },
        }}
      >
        <AppleLogo /> Continua con Apple
      </Button>
      <Button
        fullWidth
        disableElevation
        sx={{
          ...base,
          bgcolor: dark ? '#131314' : '#fff',
          color: dark ? '#E3E3E3' : '#1F1F1F',
          border: '1px solid',
          borderColor: dark ? '#8E918F' : '#747775',
          '&:hover': { bgcolor: dark ? '#1f1f20' : '#f7f8f8' },
        }}
      >
        <GoogleLogo /> Continua con Google
      </Button>
    </Box>
  );
};

const Or = ({ label }) => (
  <Divider sx={{ my: 2.5, color: 'text.secondary', fontSize: '0.875rem' }}>{label}</Divider>
);

// form: campi + bottone principale; footer: link sotto (password dimenticata, registrati...)
export const SocialSlot = ({ form, footer, emailLabel }) => {
  const variant = useVariant();
  const [emailOpen, setEmailOpen] = useState(false);

  if (variant.key === 'A') {
    return (<>{form}<Or label="oppure" /><SocialButtons />{footer && <Box sx={{ mt: 2.5 }}>{footer}</Box>}</>);
  }
  if (variant.key === 'B') {
    return (<><SocialButtons /><Or label="oppure con email" />{form}{footer}</>);
  }
  return (
    <>
      <SocialButtons />
      {emailOpen ? (
        <><Or label="con email" />{form}</>
      ) : (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setEmailOpen(true)}
          sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '1rem', gap: 1.25 }}
        >
          <MailOutlineIcon fontSize="small" /> {emailLabel}
        </Button>
      )}
      {footer && <Box sx={{ mt: 2.5 }}>{footer}</Box>}
    </>
  );
};

export const PrototypeSwitcher = () => {
  const [params, setParams] = useSearchParams();
  const variant = useVariant();
  const i = VARIANTS.indexOf(variant);
  const go = (d) => {
    const next = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length];
    const p = new URLSearchParams(params);
    p.set('variant', next.key);
    setParams(p, { replace: true });
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!import.meta.env.DEV) return null;
  return (
    <Box
      data-prototype-switcher
      sx={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 999,
        bgcolor: '#111', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      }}
    >
      <IconButton size="small" sx={{ color: '#fff' }} onClick={() => go(-1)} aria-label="precedente">‹</IconButton>
      <Typography sx={{ fontSize: 14, minWidth: 150, textAlign: 'center' }}>{variant.key} ({variant.name})</Typography>
      <IconButton size="small" sx={{ color: '#fff' }} onClick={() => go(1)} aria-label="successiva">›</IconButton>
    </Box>
  );
};
