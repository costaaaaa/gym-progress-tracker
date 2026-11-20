import { useEffect, useState } from 'react';
import { Box, Card, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MODULE_KEYS, MODULE_PATHS } from '../../hooks/useModule';
import { listGroups } from '../../api/groups';
import ModuleRow from './ModuleRow';

// Avviso sotto la riga dei Gruppi: a Gruppi non attivo serve sapere se si è ancora in qualche gruppo
const GroupsNotice = ({ on }) => {
  const { t } = useTranslation();
  const [groupsCount, setGroupsCount] = useState(null);

  useEffect(() => {
    if (on) {
      setGroupsCount(null);
      return undefined;
    }
    let cancelled = false;
    listGroups().then((res) => {
      if (!cancelled) setGroupsCount(res.ok ? res.data.groups.length : 0);
    });
    return () => { cancelled = true; };
  }, [on]);

  const showGroups = (event) => {
    event.preventDefault();
    const card = document.getElementById('groups-visibility');
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    card?.focus();
  };

  return (
    // Sempre nel DOM: l'avviso arriva dopo una lettura asincrona e così viene annunciato
    <Box role="status" sx={{ mt: !on && groupsCount > 0 ? 1 : 0 }}>
      {!on && groupsCount > 0 && (
        <>
          <Typography sx={{ fontSize: 16 }}>{t('modules.groups_warning', { count: groupsCount })}</Typography>
          <Link href="#groups-visibility" onClick={showGroups} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
            {t('modules.groups_manage')}
          </Link>
        </>
      )}
    </Box>
  );
};

// Card «Moduli» dell'Account: cosa vedere in LiftIndex. Il cambio si salva subito; `notify(messaggio, gravità)`
// lo annuncia (e mostra l'errore) nella notifica della pagina.
const ModulesCard = ({ notify }) => {
  const { t } = useTranslation();

  return (
    <Card sx={{ p: '24px' }}>
      <Typography variant="cardTitle" component="h2">{t('modules.title')}</Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, maxWidth: 560 }}>{t('modules.help')}</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1 }}>
        {MODULE_KEYS.map((key, index) => (
          <ModuleRow
            key={key}
            moduleKey={key}
            name={t(`modules.${key}.name`)}
            help={t(`modules.${key}.help`)}
            openPath={MODULE_PATHS[key]}
            first={index === 0}
            notify={notify}
            below={key === 'groups' ? (on) => <GroupsNotice on={on} /> : undefined}
          />
        ))}
      </Box>
    </Card>
  );
};

export default ModulesCard;
