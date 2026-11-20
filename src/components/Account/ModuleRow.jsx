import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isModuleActive, useSaveModules } from '../../hooks/useModule';

// Una riga della card «Moduli»: nome, descrizione, stato, «Apri» (solo se attivo) e interruttore. Il cambio si salva
// subito; `notify(messaggio, gravità)` lo annuncia (e mostra l'errore). `name` e `help` sono già tradotti, così una
// riga può stare anche per un modulo fuori dall'elenco. `children` è facoltativo: una funzione `(on) => nodo` per ciò
// che va sotto la riga, con `on` lo stato mostrato dall'interruttore (anche quello atteso durante il salvataggio).
const ModuleRow = ({ moduleKey, name, help, openPath, first = false, notify, children }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const save = useSaveModules();
  // Valore atteso mentre il salvataggio è in corso: l'interruttore lo mostra subito (null = nessun salvataggio)
  const [pending, setPending] = useState(null);

  const on = pending ?? isModuleActive(user, moduleKey);

  const toggle = async (next) => {
    // Mentre il salvataggio è in corso un altro cambio è ignorato (l'interruttore non si disattiva: il fuoco resta)
    if (pending !== null) return;
    setPending(next);
    const res = await save({ [moduleKey]: next });
    if (res.ok) {
      notify(t('modules.changed', { name, state: t(next ? 'modules.on' : 'modules.off') }), 'success');
    } else {
      notify(t('modules.save_error'), 'error');
    }
    setPending(null);
  };

  return (
    <Box component="li" sx={{ py: 1.5, borderTop: first ? 'none' : '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{name}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }}>{help}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 2, flexWrap: 'wrap', mt: 0.25 }}>
            <Typography id={`module-state-${moduleKey}`} sx={{ fontSize: 16, fontWeight: 600 }}>{t(on ? 'modules.on' : 'modules.off')}</Typography>
            {on && (
              <Link component={RouterLink} to={openPath} aria-label={t('modules.open_aria', { name })}
                sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
                {t('modules.open')}
              </Link>
            )}
          </Box>
        </Box>
        <Box
          component="label"
          title={t(on ? 'modules.turn_off' : 'modules.turn_on')}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 58, minHeight: 44 }}
        >
          <Switch
            checked={on}
            onChange={(e) => toggle(e.target.checked)}
            inputProps={{ role: 'switch', 'aria-label': name, 'aria-busy': pending !== null, 'aria-describedby': `module-state-${moduleKey}` }}
          />
        </Box>
      </Box>
      {children?.(on)}
    </Box>
  );
};

export default ModuleRow;
