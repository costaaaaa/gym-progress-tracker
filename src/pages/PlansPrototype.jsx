// PROTOTIPO USA E GETTA (A15): riepilogo di un giorno nella pagina Schede.
// Rotta di sviluppo /prototipo-schede, dati finti in memoria (nessun fetch, nessun login).
// Parametri: ?variant=A|B|C|D|AB|AB2  &vista=pagina (pagina Schede intera, tutte chiuse)  &espansa=1 (solo la prima scheda aperta)  &rosso=oggi|meno (default oggi)  &bar=0
// Fork di WorkoutPlans.jsx: tenere le modifiche qui, non toccare WorkoutPlans.
import { useState, useRef, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Typography, Box, Card, CardContent, CardActions, Button, Collapse, Grid } from '@mui/material';
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

// Nomi esercizio che entrano davvero nella larghezza disponibile: misura il testo reale con un
// elemento nascosto (stesso font) e tiene visibile "+N". Con un solo nome troppo lungo va in ellissi.
const FitNames = ({ prefix = '', names, sx, sep = ', ', sepSx }) => {
  const box = useRef(null);
  const probe = useRef(null);
  const [count, setCount] = useState(names.length);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => {
      const avail = el.clientWidth;
      const pr = probe.current;
      let k = names.length;
      for (; k > 1; k -= 1) {
        pr.textContent = `${prefix}${names.slice(0, k).join(sep)}${k < names.length ? ` +${names.length - k}` : ''}`;
        if (pr.offsetWidth <= avail) break;
      }
      setCount(k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [names, prefix, sep]);
  const more = names.length - count;
  return (
    <Box ref={box} sx={{ display: 'flex', minWidth: 0, flex: 1, position: 'relative', ...sx }}>
      <Box ref={probe} aria-hidden sx={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {prefix}
        {names.slice(0, count).map((n, i) => (
          <Box component="span" key={n + i}>
            {i > 0 && <Box component="span" sx={sepSx}>{sep}</Box>}{n}
          </Box>
        ))}
      </Box>
      {more > 0 && <Box component="span" sx={{ flexShrink: 0, whiteSpace: 'pre' }}> +{more}</Box>}
    </Box>
  );
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
  const { t } = useTranslation();
  const w = dayWarmups(day);
  return (
    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1 }}>
      {t('plans.exercises_count', { count: day.exercises.length })} · {daySets(day)} serie{w > 0 ? ` + ${w} di riscaldamento` : ''}
    </Typography>
  );
};

// Stile della card aperta: A, AB e AB2 usano le righe esercizio
const expandedStyle = (variant) => (['AB', 'AB2'].includes(variant) ? 'A' : variant);

const DaySummary = ({ day, variant }) => {
  const { t } = useTranslation();
  if (day.exercises.length === 0) {
    return <Typography variant="body2" color="text.secondary">{t('plans.no_exercises')}</Typography>;
  }
  if (expandedStyle(variant) === 'A') return <ExerciseRows day={day} />;
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
  if (variant === 'B' || variant === 'AB') {
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
          return (
            <Box key={day.id} sx={{ display: 'flex', gap: 1, fontSize: 14, alignItems: 'baseline', minWidth: 0 }}>
              <Box component="span" sx={{ fontWeight: 700, flexShrink: 0 }}>{day.name}</Box>
              <FitNames names={day.exercises.map((e) => e.exercise_name)} sx={{ color: 'text.secondary' }} />
              <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>· {daySets(day)} serie</Box>
            </Box>
          );
        })}
      </Box>
    );
  }
  const sets = plan.days.reduce((n, d) => n + daySets(d), 0);
  const shownDays = plan.days.slice(0, 3);
  const hiddenDays = days - shownDays.length;
  return (
    <>
      <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
        {t('plans.days_count', { count: days })} · {t('plans.exercises_count', { count: exercises })}
        {variant === 'C' ? ` · ${sets} serie` : ''}
      </Typography>
      {variant === 'AB2' && days > 0 && (
        <Box sx={{ mt: 0.5, fontSize: 16, color: 'text.secondary', lineHeight: 1.5 }}>
          {shownDays.map((day) => (day.exercises.length === 0 ? (
            <Box key={day.id} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {day.name}: {t('plans.no_exercises').toLowerCase()}
            </Box>
          ) : (
            <Box key={day.id} sx={{ display: 'flex' }}>
              <FitNames prefix={`${day.name}: `} names={day.exercises.map((e) => e.exercise_name)} />
            </Box>
          )))}
          {hiddenDays > 0 && <Box>+{hiddenDays} {hiddenDays === 1 ? 'giorno' : 'giorni'}</Box>}
        </Box>
      )}
    </>
  );
};

const PlanCard = ({ plan, variant, expanded, fill }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState({});
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', ...(fill ? { height: '100%' } : {}) }}>
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
      <CardActions sx={{ px: 3, pb: 2.5, pt: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
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

// ---- Round 3: varianti S1, S2, S3 e card aperta "A corretta" ----
const NEW_VARIANTS = ['S1', 'S2', 'S3'];
const isNew = (v) => NEW_VARIANTS.includes(v);
const topActive = (v) => v === 'S2' || v === 'S3';
const DEFAULT_DAY = /^Giorno\s+\S+$/i;
const NOWRAP = { whiteSpace: 'nowrap' };

// Riepilogo compatto solo nel prototipo: "a cedimento" -> "ced.", tecnica tagliata
const compactSummary = (plannedSets) => planSummary(plannedSets).split(' · ')[0].replace(/a cedimento/g, 'ced.');

// "meno": link in grigio con sottolineatura, "oggi": rosso come adesso
const linkSx = (rosso) => (rosso === 'oggi'
  ? { fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, p: 0 }
  : {
    fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, p: 0, color: 'text.secondary',
    textDecoration: 'underline', textUnderlineOffset: '3px',
    '&:hover': { color: 'text.primary', bgcolor: 'transparent', textDecoration: 'underline' },
  });

const RowsCorrected = ({ day }) => {
  const rows = day.exercises.slice(0, 4);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rows.map((e) => (
        <Box key={e.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 400, color: 'text.primary', flex: 1, minWidth: 0, lineHeight: 1.35 }}>
            {e.exercise_name}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', ...NOWRAP, fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0, lineHeight: 1.45 }}>
            {compactSummary(e.planned_sets)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const PlanCardV3 = ({ plan, variant, expanded, fill, rosso, wide }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState({});
  const days = plan.days.length;
  const exercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);
  const sets = plan.days.reduce((n, d) => n + daySets(d), 0);
  const split = days >= 2 && !plan.days.every((d) => DEFAULT_DAY.test(d.name));
  const asTop = wide && topActive(variant);
  const withSplit = !asTop && (variant === 'S1' || variant === 'S3');
  const names = plan.days.map((d) => d.name);

  let closedBody;
  if (days === 0) {
    closedBody = <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>Nessun giorno: aggiungine uno</Typography>;
  } else if (asTop) {
    const shown = plan.days.slice(0, 4);
    const hidden = days - shown.length;
    closedBody = (
      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {shown.map((day) => (
          <Box key={day.id} sx={{ display: 'flex', gap: 1.25, fontSize: 14, alignItems: 'baseline', minWidth: 0 }}>
            <Box component="span" sx={{ fontWeight: 500, color: 'text.primary', flexShrink: 0 }}>{day.name}</Box>
            {day.exercises.length === 0
              ? <Box component="span" sx={{ color: 'text.secondary' }}>· vuoto</Box>
              : <FitNames names={day.exercises.map((e) => e.exercise_name)} sx={{ color: 'text.secondary' }} />}
          </Box>
        ))}
        {hidden > 0 && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>+{hidden} {hidden === 1 ? 'giorno' : 'giorni'}</Typography>}
      </Box>
    );
  } else if (withSplit) {
    closedBody = (
      <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
        {split
          ? `${t('plans.exercises_count', { count: exercises })} · ${sets} serie`
          : `${t('plans.days_count', { count: days })} · ${t('plans.exercises_count', { count: exercises })} · ${sets} serie`}
      </Typography>
    );
  } else {
    closedBody = (
      <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
        {t('plans.days_count', { count: days })} · {t('plans.exercises_count', { count: exercises })}
      </Typography>
    );
  }

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', ...(fill ? { height: '100%' } : {}) }}>
      <CardContent sx={{ p: 3, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{plan.name}</Typography>
          {!!plan.is_active && (
            <Box component="span" sx={{ bgcolor: 'success.muted', color: 'success.title', fontSize: 13, fontWeight: 700, px: 1.25, py: 0.5, borderRadius: radius.pill }}>
              {t('plans.active_badge')}
            </Box>
          )}
        </Box>
        {!expanded && withSplit && split && (
          <Box sx={{ display: 'flex', mb: 0.75, fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
            <FitNames names={names} sep=" / " sepSx={{ color: 'text.secondary' }} />
          </Box>
        )}
        {plan.description && (
          <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.5 }}>{plan.description}</Typography>
        )}

        {expanded ? (
          <Box sx={{ mt: 2.25, pt: 2.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {days === 0 && <Typography sx={{ color: 'text.secondary' }}>Nessun giorno: aggiungine uno</Typography>}
            {plan.days.map((day) => {
              const isOpen = !!open[day.id];
              const toggle = () => setOpen((o) => ({ ...o, [day.id]: !o[day.id] }));
              const more = day.exercises.length - 4;
              return (
                <Box key={day.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>{day.name}</Typography>
                    <Button variant="text" size="small" aria-expanded={isOpen} onClick={toggle} sx={linkSx(rosso)}>
                      {isOpen ? t('plans.hide') : t('plans.details')}
                    </Button>
                  </Box>
                  {day.exercises.length === 0
                    ? <Typography variant="body2" color="text.secondary">{t('plans.no_exercises')}</Typography>
                    : <RowsCorrected day={day} />}
                  {more > 0 && !isOpen && (
                    <Button variant="text" size="small" onClick={toggle} sx={{ ...linkSx(rosso), mt: 0.75, display: 'flex' }}>
                      +{more} {more === 1 ? 'esercizio' : 'esercizi'}
                    </Button>
                  )}
                  <Collapse in={isOpen} timeout="auto">
                    <Box sx={{ mt: 1.25, borderRadius: radius.md, p: '12px 14px', bgcolor: 'background.subtle' }}>
                      <DayDetails day={day} />
                    </Box>
                  </Collapse>
                  <Button variant="text" size="small" sx={{ ...linkSx(rosso), mt: 1, display: 'flex' }}>{t('plans.add_exercise')}</Button>
                </Box>
              );
            })}
          </Box>
        ) : closedBody}
      </CardContent>
      <CardActions sx={{ px: 3, pb: 2.5, pt: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between', gap: 1 }}>
        <Button size="small" variant="text" sx={{ fontSize: 15, fontWeight: 600, textTransform: 'none', color: 'text.secondary', minWidth: 0, p: 0, ...NOWRAP }}>
          {expanded ? 'Nascondi giorni' : 'Mostra giorni'}
        </Button>
        {!plan.is_active && (
          <Button
            size="small" variant="outlined"
            sx={{ color: 'text.primary', borderColor: 'text.secondary', borderRadius: radius.sm, px: 1.5, py: 1, fontSize: 15, fontWeight: 600, textTransform: 'none', ...NOWRAP }}
          >
            {t('plans.activate')}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

const PlansPrototype = () => {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const variant = parseVariant(params.get('variant'));
  const rosso = params.get('rosso') === 'meno' ? 'meno' : 'oggi';
  const newV = isNew(variant);
  if (params.get('vista') === 'pagina') {
    // Come WorkoutPlans.jsx: Box p:3, titolo, riga con "Nuova scheda", Grid 2.5 con card xs=12 md=6, tutte chiuse
    return (
      <Box sx={{ p: 3, pb: 14 }}>
        <Typography variant="pageTitle" gutterBottom>{t('plans.page_title')}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20 }}>{t('plans.section_title')}</Typography>
          <Button variant="contained" sx={{ fontSize: 16, fontWeight: 600 }}>{t('plans.new')}</Button>
        </Box>
        <Grid container spacing={2.5}>
          {(params.get('espansa') === '1' ? PLANS.slice(0, 1) : PLANS).map((plan, i) => {
            const wide = newV && topActive(variant) && !!plan.is_active;
            return (
              <Grid item xs={12} md={wide ? 12 : 6} key={plan.id}>
                <Box sx={{ height: '100%', display: 'flex', '& > *': { flex: 1 } }}>
                  {newV
                    ? <PlanCardV3 plan={plan} variant={variant} expanded={params.get('espansa') === '1' && i === 0} fill rosso={rosso} wide={wide} />
                    : <PlanCard plan={plan} variant={variant} expanded={false} fill />}
                </Box>
              </Grid>
            );
          })}
        </Grid>
        <PrototypeSwitcher current={variant} />
      </Box>
    );
  }
  return (
    <Container maxWidth="md" sx={{ py: 3, pb: 14 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20, mb: 2 }}>Schede</Typography>
      {[['Chiusa', 0, false], ['Aperta', 0, true], ['Seconda scheda, aperta', 1, true]].map(([label, idx, exp]) => (
        <Box key={label}>
          <Heading>{label}</Heading>
          {newV
            ? <PlanCardV3 plan={PLANS[idx]} variant={variant} expanded={exp} rosso={rosso} wide={false} />
            : <PlanCard plan={PLANS[idx]} variant={variant} expanded={exp} />}
        </Box>
      ))}
      <PrototypeSwitcher current={variant} />
    </Container>
  );
};

export default PlansPrototype;
