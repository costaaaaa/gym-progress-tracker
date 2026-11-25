import { useState } from 'react';
import { Avatar, Box, Button, Card, Typography } from '@mui/material';
import { DeleteForever as DeleteForeverIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAuth } from '../../context/AuthContext';
import useAccountDeleted from '../../hooks/useAccountDeleted';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { NEUTRAL_OUTLINED, DANGER_TEXT } from '../../utils/buttonStyles';
import AccountTier from '../../components/Account/AccountTier';
import DeleteAccountDialog from '../../components/Account/DeleteAccountDialog';
import AccountIdentity from './AccountIdentity';
import AccountRow from './AccountRow';
import RowList from './RowList';

// Elenco dell'Account (/account): la testata (avatar, nome utente, email e livello), le quattro voci che portano alle loro pagine,
// la voce dell'amministrazione per chi lo è, «Esci» e «Elimina account». I dati arrivano dalla cornice (Account).
const AccountList = () => {
  const { t } = useTranslation();
  usePageMeta(t('account.title'), t('account.meta.description'));
  const { account, notify } = useOutletContext();
  const { logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const handleAccountDeleted = useAccountDeleted(notify);

  const rows = [
    { to: '/account/profilo', title: t('account.section.profile_prefs.title'), help: t('account.section.profile_prefs.help') },
    { to: '/account/moduli', title: t('modules.title'), help: t('account.section.modules.help') },
    { to: '/account/dati', title: t('account.section.data.title'), help: t('account.section.data.help') },
    { to: '/account/sicurezza', title: t('account.section.security.title'), help: t('account.password.title') },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="pageTitle">{t('account.title')}</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{
          width: 64, height: 64,
          bgcolor: 'ink',
          color: 'onInk',
          fontFamily: TITLE_FONT_FAMILY,
          fontWeight: 700,
          fontSize: 20,
          flexShrink: 0,
        }}>
          {account?.username?.charAt(0).toUpperCase() || '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AccountIdentity account={account} />
          <AccountTier tier={account?.tier} lastDay={account?.tier_last_day} signupCode={account?.signup_code} />
        </Box>
      </Box>

      <RowList>
        {rows.map(({ to, title, help }) => <AccountRow key={to} to={to} title={title} help={help} />)}
      </RowList>

      {account?.is_admin && (
        <Card>
          <AccountRow to="/admin" title={t('account.admin.title')} help={t('account.admin.help')} />
        </Card>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button variant="outlined" fullWidth startIcon={<LogoutIcon />} onClick={logout} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}>
          {t('account.session.logout')}
        </Button>
        <Button startIcon={<DeleteForeverIcon />} onClick={() => setDeleteOpen(true)} sx={{ ...DANGER_TEXT, alignSelf: 'center', minHeight: 44 }}>
          {t('account.delete.title')}
        </Button>
      </Box>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={handleAccountDeleted} />
    </Box>
  );
};

export default AccountList;
