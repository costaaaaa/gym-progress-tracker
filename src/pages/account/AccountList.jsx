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
import { tierName } from '../../utils/tiers';
import DeleteAccountDialog from '../../components/Account/DeleteAccountDialog';
import AccountRow from './AccountRow';

// Elenco dell'Account (/account): la testata (avatar, nome utente, email), le sei voci che portano alle loro pagine,
// la voce dell'amministrazione per chi lo è, «Esci» e «Elimina account». I dati arrivano dalla cornice (Account).
const AccountList = () => {
  const { t } = useTranslation();
  usePageMeta(t('account.title'), t('account.meta.description'));
  const { account, notify } = useOutletContext();
  const { logout, emailState } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const handleAccountDeleted = useAccountDeleted(notify);

  // Senza il campo del livello (server più vecchio) la voce del piano resta senza riga di aiuto
  const tierHelp = account?.tier ? (account.tier === 'free' ? t('account.tier.free') : tierName(account.tier)) : undefined;
  const rows = [
    ['/account/profilo', t('account.section.profile.title'), t('account.section.profile.help')],
    ['/account/preferenze', t('account.section.preferences.title'), t('account.section.preferences.help')],
    ['/account/moduli', t('modules.title'), t('account.section.modules.help')],
    ['/account/piano', t('account.section.tier.title'), tierHelp],
    ['/account/dati', t('account.section.data.title'), t('account.section.data.help')],
    ['/account/sicurezza', t('account.section.security.title'), t('account.password.title')],
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
          <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
            {account?.username || t('account.user_fallback')}
          </Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {emailState?.email || account?.email || t('account.email_unavailable')}
          </Typography>
        </Box>
      </Box>

      <Card>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map(([to, title, help], index) => (
            <Box component="li" key={to} sx={index > 0 ? { borderTop: '1px solid', borderColor: 'divider' } : undefined}>
              <AccountRow to={to} title={title} help={help} />
            </Box>
          ))}
        </Box>
      </Card>

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
