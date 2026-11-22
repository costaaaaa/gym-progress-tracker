import { useEffect, useState } from 'react';
import { Box, Card, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MODULE_KEYS, MODULE_PATHS } from '../../hooks/useModule';
import { listGroups } from '../../api/groups';
import { INK_LINK } from '../../utils/buttonStyles';
import ModuleRow from './ModuleRow';

// Avviso sotto la riga dei Gruppi: a Gruppi non attivo serve sapere se si è ancora in qualche gruppo. I collegamenti
// portano a «Dati e privacy», dove sta la card «Gruppi e visibilità»: lì il fuoco arriva da solo.
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

  return (
    // Sempre nel DOM: l'avviso arriva dopo una lettura asincrona e così viene annunciato
    <Box role="status" sx={{ mt: !on && groupsCount > 0 ? 1 : 0 }}>
      {!on && groupsCount > 0 && (
        <>
          <Typography sx={{ fontSize: 16 }}>{t('modules.groups_warning', { count: groupsCount })}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
            <Link component={RouterLink} to="/account/dati#groups-shown" sx={INK_LINK}>{t('modules.groups_show')}</Link>
            <Link component={RouterLink} to="/account/dati#groups-list" sx={INK_LINK}>{t('modules.groups_leave')}</Link>
          </Box>
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
      <Typography sx={{ fontSize: 16, color: 'text.secondary', maxWidth: 560 }}>{t('modules.help')}</Typography>
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
