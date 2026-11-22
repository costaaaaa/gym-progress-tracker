import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import ActiveBadge from './ActiveBadge';

// La card di una scheda nell'elenco: nome, numero di giorni ed «Attiva». Tutta la card è il collegamento alla pagina
// della scheda; il suo nome accessibile è il nome della scheda (più «Attiva»), i giorni ne sono la descrizione.
const PlanListCard = ({ plan }) => {
  const { t } = useTranslation();
  const nameId = `plan-card-name-${plan.id}`;
  const badgeId = `plan-card-badge-${plan.id}`;
  const daysId = `plan-card-days-${plan.id}`;
  const active = !!plan.is_active;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        component={RouterLink}
        to={`/schede/${plan.id}`}
        aria-labelledby={active ? `${nameId} ${badgeId}` : nameId}
        aria-describedby={daysId}
        sx={{ minHeight: 64, height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', maxWidth: '100%' }}>
          <Typography id={nameId} sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16, overflowWrap: 'anywhere' }}>
            {plan.name}
          </Typography>
          {active && <ActiveBadge id={badgeId} />}
        </Box>
        <Typography id={daysId} sx={{ mt: 0.5, fontSize: 16, color: 'text.secondary' }}>
          {t('plans.days_count', { count: plan.days?.length ?? 0 })}
        </Typography>
      </CardActionArea>
    </Card>
  );
};

export default PlanListCard;
