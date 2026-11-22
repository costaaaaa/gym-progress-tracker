import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Motivo di sola lettura → testo con il numero (limite in account.limits), testo senza numero, chiave del limite
const READ_ONLY_NOTICE = {
  plans_over_limit: { key: 'plans.read_only_plans', genericKey: 'plans.read_only_plans_generic', limit: 'plans' },
  days_over_limit: { key: 'plans.read_only_days', genericKey: 'plans.read_only_days_generic', limit: 'days_per_plan' },
};

// Quale avviso spetta a una scheda in sola lettura (null se non lo è). «Troppi giorni» riguarda una scheda sola: sta
// nella sua pagina. Con «troppe schede» il server le segna tutte: nella pagina c'è lo stesso avviso, e sopra l'elenco
// una volta sola; lì finisce anche un motivo che questa pagina non conosce.
export const readOnlyNoticeReason = (plan) => {
  if (!plan.read_only) return null;
  return plan.read_only_reason === 'days_over_limit' ? 'days_over_limit' : 'plans_over_limit';
};

// Avviso di sola lettura. Senza il limite dell'account (lettura fallita o valore null) la frase non ha numero.
const ReadOnlyNotice = ({ reason, limits, isFree }) => {
  const { t } = useTranslation();
  const notice = READ_ONLY_NOTICE[reason];
  const max = limits?.[notice.limit];
  return (
    <Alert severity="info" sx={{ mb: 1.5 }}>
      {max == null ? t(notice.genericKey) : t(notice.key, { max })}
      {isFree && ` ${t('plans.read_only_raise')}`}
    </Alert>
  );
};

export default ReadOnlyNotice;
