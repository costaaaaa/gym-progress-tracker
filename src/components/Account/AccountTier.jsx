import { Box, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { plansPath } from '../../i18n/paths';
import { tierName } from '../../utils/tiers';


// Riga del livello nella card del profilo, da user/read.php: tier e tier_last_day (ultimo giorno compreso, AAAA-MM-GG,
// ora italiana: si scrive com'è, senza fuso) descrivono l'account; signup_code {status, tier} il codice di registrazione
// (qui tier è quello del codice). Prima della conferma dell'email l'account è Gratis e il codice è «pending».
// Senza il campo tier (server più vecchio) non si mostra nulla.
const AccountTier = ({ tier, lastDay, signupCode }) => {
  const { t, i18n } = useTranslation();
  if (!tier) return null;

  let value;
  if (tier !== 'free') {
    value = lastDay
      ? t('account.tier.until', { tier: tierName(tier), date: formatDate(lastDay, { day: 'numeric', month: 'long', year: 'numeric' }) })
      : t('account.tier.forever', { tier: tierName(tier) });
  } else if (signupCode?.status === 'pending') {
    value = t('account.tier.pending', { tier: tierName(signupCode.tier) });
  } else if (signupCode?.status === 'missed') {
    value = t('account.tier.missed');
  } else {
    value = t('account.tier.free');
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, mt: 0.5 }}>
      <Typography data-testid="account-tier" sx={{ fontSize: 16, color: 'text.secondary' }}>
        {t('account.tier.row', { value })}
      </Typography>
      <Link
        href={plansPath(i18n.language)}
        color="text.primary"
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 16, fontWeight: 600 }}
      >
        {t('account.tier.plans')}
      </Link>
    </Box>
  );
};

export default AccountTier;
