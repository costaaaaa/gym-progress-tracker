import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, Link, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isModuleActive, MODULE_KEYS } from '../../hooks/useModule';
import { saveModules } from '../../api/modules';
import { listGroups } from '../../api/groups';

// Pagina di oggi di ogni modulo: dove porta «Apri»
const OPEN_PATH = {
  body: '/dashboard?tab=body',
  recovery: '/dashboard?tab=muscles',
  levels: '/profilo',
  groups: '/gruppi',
};

// Card «Moduli» dell'Account: cosa vedere in LiftIndex. Il cambio si salva subito; `notify(messaggio, gravità)`
// lo annuncia (e mostra l'errore) nella notifica della pagina.
const ModulesCard = ({ notify }) => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  // Valore atteso di un modulo mentre il suo salvataggio è in corso: l'interruttore lo mostra subito
  const [pending, setPending] = useState({});
  const [groupsCount, setGroupsCount] = useState(null);

  const active = (key) => pending[key] ?? isModuleActive(user, key);
  const groupsActive = active('groups');

  // A Gruppi non attivo serve sapere se si è ancora in qualche gruppo, per l'avviso
  useEffect(() => {
    if (groupsActive) {
      setGroupsCount(null);
      return undefined;
    }
    let cancelled = false;
    listGroups().then((res) => {
      if (!cancelled) setGroupsCount(res.ok ? res.data.groups.length : 0);
    });
    return () => { cancelled = true; };
  }, [groupsActive]);

  const toggle = async (key, next) => {
    setPending((p) => ({ ...p, [key]: next }));
    const res = await saveModules({ [key]: next });
    if (res.ok) {
      updateUser({ modules: res.modules });
      notify(t('modules.changed', { name: t(`modules.${key}.name`), state: t(next ? 'modules.on' : 'modules.off') }), 'success');
    } else {
      notify(t('modules.save_error'), 'error');
    }
    setPending((p) => {
      const { [key]: _done, ...rest } = p;
      return rest;
    });
  };

  const showGroups = (event) => {
    event.preventDefault();
    const card = document.getElementById('groups-visibility');
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    card?.focus();
  };

  return (
    <Card sx={{ p: '24px' }}>
      <Typography variant="cardTitle" component="h2">{t('modules.title')}</Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>{t('modules.help')}</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1 }}>
        {MODULE_KEYS.map((key, index) => {
          const on = active(key);
          const name = t(`modules.${key}.name`);
          return (
            <Box component="li" key={key} sx={{ py: 1.5, borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{name}</Typography>
                  <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }}>{t(`modules.${key}.help`)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 2, flexWrap: 'wrap', mt: 0.25 }}>
                    <Typography id={`module-state-${key}`} sx={{ fontSize: 16, fontWeight: 600 }}>{t(on ? 'modules.on' : 'modules.off')}</Typography>
                    {on && (
                      <Link component={RouterLink} to={OPEN_PATH[key]} aria-label={t('modules.open_aria', { name })}
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
                    disabled={key in pending}
                    onChange={(e) => toggle(key, e.target.checked)}
                    inputProps={{ role: 'switch', 'aria-label': name, 'aria-describedby': `module-state-${key}` }}
                  />
                </Box>
              </Box>
              {key === 'groups' && !on && groupsCount > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: 16 }}>{t('modules.groups_warning', { count: groupsCount })}</Typography>
                  <Link href="#groups-visibility" onClick={showGroups} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
                    {t('modules.groups_manage')}
                  </Link>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
};

export default ModulesCard;
