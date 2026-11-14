// PROTOTIPO USA E GETTA (A15): riepilogo di un giorno nella pagina Schede.
// Rotta di sviluppo /prototipo-schede, dati finti in memoria (nessun fetch, nessun login).
// Parametri: ?variant=A..D  &bar=0
// Fork di WorkoutPlans.jsx: tenere le modifiche qui, non toccare WorkoutPlans.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Typography, Box, Card, CardContent, CardActions, Button, Collapse } from '@mui/material';
import PrototypeSwitcher, { parseVariant } from '../components/PrototypeSwitcher';
import { muscleLabel } from '../i18n/labels';
import { planSummary, compactForm, workingOf, plannedOf, targetLabel } from '../utils/plannedSets';
import { TITLE_FONT_FAMILY } from '../utils/fonts';
import { radius } from '../theme/radius';
import { PLANS } from './plansPrototypeData';

const groupByMuscle = (exercises) => {
  const groups = {};
  exercises.forEach((e) => {
    const g = e.muscle_group.charAt(0).toUpperCase() + e.muscle_group.slice(1);
    (groups[g] = groups[g] || []).push(e);
  });
  return Object.keys(groups).map((name) => ({ name, exercises: groups[name], count: groups[name].length }));
};

const workingCount = (ex) => workingOf(plannedOf(ex)).length;
const warmupCount = (ex) => plannedOf(ex).length - workingCount(ex);
const daySets = (day) => day.exercises.reduce((n, e) => n + workingCount(e), 0);
const dayWarmups = (day) => day.exercises.reduce((n, e) => n + warmupCount(e), 0);

// Variante C: "3×8-10", oppure "N serie" se le serie non si scrivono in forma compatta
const chipLabel = (ex) => {
  const form = compactForm(plannedOf(ex));
  const n = workingCount(ex);
  if (!form || form.target.to_failure || form.technique) return `${n} serie`;
  return `${form.sets}×${targetLabel({ ...form.target })}`;
};

// Variante B: nomi finché stanno in un budget di caratteri, poi "+N"
const previewNames = (exercises, budget = 26) => {
  const shown = [];
  let used = 0;
  for (const e of exercises) {
    if (shown.length > 0 && used + e.exercise_name.length > budget) break;
    shown.push(e.exercise_name);
    used += e.exercise_name.length + 2;
  }
  return { text: shown.join(', '), more: exercises.length - shown.length };
};

const MuscleChips = ({ day }) => (
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    {groupByMuscle(day.exercises).map((group) => (
      <Box
        key={group.name}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: radius.sm, px: 1.5, py: 0.75, fontSize: 12, fontWeight: 600 }}
      >
        {muscleLabel(group.name)} ({group.count})
      </Box>
    ))}
  </Box>
);

const ExerciseRows = ({ day, max = 4 }) => {
  const rows = day.exercises.slice(0, max);
  const rest = day.exercises.length - rows.length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {rows.map((e) => (
        <Box key={e.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{e.exercise_name}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0, maxWidth: '55%', textAlign: 'right' }}>
            {planSummary(e.planned_sets)}
          </Typography>
        </Box>
      ))}
      {rest > 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>+{rest} altri</Typography>}
    </Box>
  );
};

const ExerciseChips = ({ day }) => (
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    {day.exercises.map((e) => (
      <Box
        key={e.id}
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: radius.sm, px: 1.5, py: 0.75,
          fontSize: 12, fontWeight: 600, display: 'flex', gap: 0.75, maxWidth: '100%', minWidth: 0,
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {e.exercise_name}
        </Box>
        <Box component="span" sx={{ flexShrink: 0, color: 'text.secondary' }}>{chipLabel(e)}</Box>
      </Box>
    ))}
  </Box>
);

const DayTotals = ({ day }) => {
  const w = dayWarmups(day);
  return (
    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1 }}>
      {day.exercises.length} esercizi · {daySets(day)} serie{w > 0 ? ` + ${w} di riscaldamento` : ''}
    </Typography>
  );
};

const DaySummary = ({ day, variant }) => {
  const { t } = useTranslation();
  if (day.exercises.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t('plans.no_exercises')}</Typography>;
  }
  if (variant === 'A') return <ExerciseRows day={day} />;
  if (variant === 'C') return <ExerciseChips day={day} />;
  return <MuscleChips day={day} />;
};

const DayDetails = ({ day }) => {
  const { t } = useTranslation();
  if (day.exercises.length === 0) {
    return <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 1 }}>{t('plans.no_exercises_day')}</Typography>;
  }
  return day.exercises.map((e) => (
    <Box key={e.id} sx={{ mb: 1.5, '&:last-of-type': { mb: 0 } }}>
      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{e.exercise_name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('plans.plan_line', { summary: planSummary(e.planned_sets), rest: e.rest })}
      </Typography>
    </Box>
  ));
};

const ClosedSummary = ({ plan, variant }) => {
  const { t } = useTranslation();
  const days = plan.days.length;
  const exercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);
  if (variant === 'B') {
    return (
      <Box sx={{ mt: 1.75, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {plan.days.map((day) => {
          if (day.exercises.length === 0) {
            return (
              <Box key={day.id} sx={{ display: 'flex', gap: 1, fontSize: 14 }}>
                <Box component="span" sx={{ fontWeight: 700, flexShrink: 0 }}>{day.name}</Box>
                <Box component="span" sx={{ color: 'text.secondary' }}>{t('plans.no_exercises')}</Box>
              </Box>
            );
          }
          const { text, more } = previewNames(day.exercises);
          return (
            <Box key={day.id} sx={{ display: 'flex', gap: 1, fontSize: 14, alignItems: 'baseline', minWidth: 0 }}>
              <Box component="span" sx={{ fontWeight: 700, flexShrink: 0 }}>{day.name}</Box>
              <Box component="span" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>
                {text}
              </Box>
              {more > 0 && <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>+{more}</Box>}
              <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>· {daySets(day)} serie</Box>
            </Box>
          );
        })}
      </Box>
    );
  }
  const sets = plan.days.reduce((n, d) => n + daySets(d), 0);
  return (
    <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
      {t('plans.days_count', { count: days })} · {t('plans.exercises_count', { count: exercises })}
      {variant === 'C' ? ` · ${sets} serie` : ''}
    </Typography>
  );
};

const PlanCard = ({ plan, variant, expanded }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState({});
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 3, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{plan.name}</Typography>
          {!!plan.is_active && (
            <Box component="span" sx={{ bgcolor: 'success.muted', color: 'success.title', fontSize: 13, fontWeight: 700, px: 1.25, py: 0.5, borderRadius: radius.pill }}>
              {t('plans.active_badge')}
            </Box>
          )}
        </Box>
        {plan.description && (
          <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.5 }}>{plan.description}</Typography>
        )}

        {expanded ? (
          <Box sx={{ mt: 2.25, pt: 2.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {plan.days.map((day) => (
              <Box key={day.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: variant === 'D' ? 0.25 : 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{day.name}</Typography>
                  <Button
                    variant="text" size="small" aria-expanded={!!open[day.id]}
                    onClick={() => setOpen((o) => ({ ...o, [day.id]: !o[day.id] }))}
                    sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, p: 0 }}
                  >
                    {open[day.id] ? t('plans.hide') : t('plans.details')}
                  </Button>
                </Box>
                {variant === 'D' && day.exercises.length > 0 && <DayTotals day={day} />}
                <Box sx={{ mb: 1 }}><DaySummary day={day} variant={variant} /></Box>
                <Collapse in={!!open[day.id]} timeout="auto">
                  <Box sx={{ mt: 1.25, mb: 1.5, borderRadius: radius.md, p: '12px 14px', bgcolor: 'background.subtle' }}>
                    <DayDetails day={day} />
                  </Box>
                </Collapse>
                <Button size="small" sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}>{t('plans.add_exercise')}</Button>
              </Box>
            ))}
          </Box>
        ) : (
          <ClosedSummary plan={plan} variant={variant} />
        )}
      </CardContent>
      <CardActions sx={{ px: 3, pb: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
        <Button size="small" variant="text" sx={{ fontSize: 16, fontWeight: 600, textTransform: 'none', color: 'text.secondary', minWidth: 0, p: 0 }}>
          {expanded ? t('plans.hide_details') : t('plans.show_details')}
        </Button>
        {!plan.is_active && (
          <Button
            size="small" variant="outlined"
            sx={{ color: 'text.primary', borderColor: 'text.secondary', borderRadius: radius.sm, px: 2, py: 1, fontSize: 16, fontWeight: 600, textTransform: 'none' }}
          >
            {t('plans.activate')}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

const Heading = ({ children }) => (
  <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 1, mt: 1 }}>
    {children}
  </Typography>
);

const PlansPrototype = () => {
  const [params] = useSearchParams();
  const variant = parseVariant(params.get('variant'));
  return (
    <Container maxWidth="md" sx={{ py: 3, pb: 14 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20, mb: 2 }}>Schede</Typography>
      <Heading>Chiusa</Heading>
      <PlanCard plan={PLANS[0]} variant={variant} expanded={false} />
      <Heading>Aperta</Heading>
      <PlanCard plan={PLANS[0]} variant={variant} expanded />
      <Heading>Seconda scheda, aperta</Heading>
      <PlanCard plan={PLANS[1]} variant={variant} expanded />
      <PrototypeSwitcher current={variant} />
    </Container>
  );
};

export default PlansPrototype;
