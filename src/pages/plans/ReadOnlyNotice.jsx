import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Motivo di sola lettura → testo con il numero (limite in account.limits), testo senza numero, chiave del limite
const READ_ONLY_NOTICE = {
  plans_over_limit: { key: 'plans.read_only_plans', genericKey: 'plans.read_only_plans_generic', limit: 'plans' },
  days_over_limit: { key: 'plans.read_only_days', genericKey: 'plans.read_only_days_generic', limit: 'days_per_plan' },
};

// «Troppi giorni» riguarda una scheda sola: l'avviso sta sulla sua card. Con «troppe schede» il server le segna
// tutte: l'avviso sta una volta sola sopra l'elenco, e lì finisce anche un motivo che questa pagina non conosce.
export const readOnlyOnCard = (plan) => plan.read_only && plan.read_only_reason === 'days_over_limit';

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
