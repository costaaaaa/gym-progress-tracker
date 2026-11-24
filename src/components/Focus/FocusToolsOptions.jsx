import { useEffect, useRef, useState } from 'react';
import { Box, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useSaveFocusTool } from '../../hooks/useSaveFocusTool';
import { FOCUS_TOOLS, isToolOn } from '../../utils/focusTools';

// Nome e aiuto di ogni strumento: il timer di recupero ha i testi che aveva già nell'Account
const TEXTS = {
  rest_timer: { name: 'account.rest_timer', help: 'account.rest_timer_help' },
  technique: { name: 'focus.tools.technique.name', help: 'focus.tools.technique.help' },
  suggested_weight: { name: 'focus.tools.suggested_weight.name', help: 'focus.tools.suggested_weight.help' },
};

// I tre strumenti della serie dell'account: una riga con interruttore ciascuno, il cambio si salva subito.
// `notify(messaggio, gravità)` annuncia l'esito (e mostra l'errore). Senza `notify` (dentro una finestra, dove la
// notifica della pagina non si legge) l'esito sta qui sotto: una regione «status» e una «alert», sempre nel DOM.
// `onSavingChange(saving)` (facoltativa) è chiamata con true quando comincia il primo salvataggio in corso e con false
// quando finisce l'ultimo, così chi ospita gli interruttori (una finestra) non si chiude a metà.
// Usato prima dell'allenamento e in Account.
const FocusToolsOptions = ({ notify, idPrefix, onSavingChange }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const save = useSaveFocusTool();
  // Strumenti con un salvataggio in corso, col valore atteso: l'interruttore lo mostra subito
  const [pending, setPending] = useState({});
  const [inline, setInline] = useState({ status: '', alert: '' });
  const saving = Object.keys(pending).length > 0;
  const reportedSaving = useRef(false);
  useEffect(() => {
    if (saving === reportedSaving.current) return;
    reportedSaving.current = saving;
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);
  const announce = (message, severity) => (notify
    ? notify(message, severity)
    : setInline(severity === 'error' ? { status: '', alert: message } : { status: message, alert: '' }));

  const toggle = async (tool, next) => {
    // Mentre il salvataggio è in corso un altro cambio dello stesso strumento è ignorato (il fuoco resta sull'interruttore)
    if (tool in pending) return;
    setPending((p) => ({ ...p, [tool]: next }));
    // Le regioni ripartono vuote: un esito uguale a quello di prima non verrebbe riletto
    if (!notify) setInline({ status: '', alert: '' });
    const res = await save(tool, next);
    if (res.ok) {
      announce(t('focus.tools.changed', { name: t(TEXTS[tool].name), state: t(next ? 'focus.tools.on' : 'focus.tools.off') }), 'success');
    } else {
      announce(t('focus.tools.save_error'), 'error');
    }
    setPending((p) => {
      const rest = { ...p };
      delete rest[tool];
      return rest;
    });
  };

  return (
    <>
      <Box component="ul" aria-label={t('focus.tools.title')} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {FOCUS_TOOLS.map((tool, index) => {
          const helpId = `${idPrefix}-${tool}-help`;
          return (
            <Box component="li" key={tool} sx={{ py: 1.25, borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t(TEXTS[tool].name)}</Typography>
                  <Typography id={helpId} sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }}>{t(TEXTS[tool].help)}</Typography>
                </Box>
                <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 58, minHeight: 44 }}>
                  <Switch
                    checked={pending[tool] ?? isToolOn(user, tool)}
                    onChange={(e) => toggle(tool, e.target.checked)}
                    inputProps={{ role: 'switch', 'aria-label': t(TEXTS[tool].name), 'aria-busy': tool in pending, 'aria-describedby': helpId }}
                  />
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {!notify && (
        <>
          {/* Sempre nel DOM, ma vuote non occupano spazio */}
          <Typography role="status" sx={{ fontSize: 16, mt: inline.status ? 1 : 0 }}>{inline.status}</Typography>
          <Typography role="alert" sx={{ fontSize: 16, color: 'error.main', mt: inline.alert ? 1 : 0 }}>{inline.alert}</Typography>
        </>
      )}
    </>
  );
};

export default FocusToolsOptions;
