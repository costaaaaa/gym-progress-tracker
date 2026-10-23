// PROTOTIPO #31 D2 (branch usa e getta): tre modi di mostrare gli esercizi in Progressi.
// A = card ripulite (come oggi), B = righe con mini grafico dentro il gruppo, C = elenco unico senza grafici.
import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Card, CardActionArea, Chip, Divider, Grid, IconButton, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/format';
import { muscleLabel } from '../../i18n/labels';
import { buildPoints } from '../../components/ChartCard';
import { dayTime } from '../../utils/calendarDay';
import { STATUS, showsDelta } from '../../utils/progressOverview';
import { formatDaysAgo, formatValue } from '../../components/ExerciseProgressCard';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

export const VARIANT_NAMES = { A: 'card ripulite', B: 'righe con grafico', C: 'elenco senza grafici' };

const statNumber = { fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 };

// D3: su = verde, giù = ambra, fermo/nuovo grigio, inattivo più chiaro
const DELTA_COLOR = { improving: 'success.main', declining: 'recovery.recovering', stalled: 'text.secondary', new: 'text.secondary', inactive: 'text.disabled' };
const Delta = ({ item, fontSize = 14 }) => {
  const { t } = useTranslation();
  return (
    <Typography component="span" sx={{ fontSize, fontWeight: 600, color: DELTA_COLOR[item.status], whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {showsDelta(item)
        ? `${item.deltaPct >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(item.deltaPct), { maximumFractionDigits: 1 })}%`
        : t(`progress.status.${item.status}`)}
    </Typography>
  );
};

const Spark = ({ item, w, h }) => {
  const points = item.sessions.slice(-12).map((s) => ({ x: dayTime(s.date), value: s.value }));
  if (points.length < 2) return <Box sx={{ width: w, height: h, flexShrink: 0 }} />;
  const color = item.status === STATUS.IMPROVING ? 'success.main' : 'text.secondary';
  return (
    <Box sx={{ width: w, height: h, color, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={buildPoints(points, [points[0].x, points.at(-1).x], w, h, 3)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Box>
  );
};

const Star = ({ item, favorite, onToggleFavorite, sx }) => {
  const { t } = useTranslation();
  return (
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
      aria-label={favorite ? t('progress.favorite_remove') : t('progress.favorite_add')}
      aria-pressed={favorite}
      sx={{ width: 44, height: 44, flexShrink: 0, color: favorite ? 'warning.main' : 'text.disabled', ...sx }}
    >
      {favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
    </IconButton>
  );
};

const SectionHeader = ({ label, section }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 18 }}>
        {label} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 16 }}>· {t('progress.section_count', { count: section.items.length })}</Box>
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
        {section.improving > 0 && `${t('progress.section_improving', { count: section.improving })} · `}
        {t('progress.last_session', { when: formatDaysAgo(t, section.lastDays) })}
      </Typography>
    </Box>
  );
};

const accordionSx = { border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: '12px !important', '&:before': { display: 'none' } };

// ---------- A: card ripulite (stessa struttura di oggi) ----------
const CardA = ({ item, showMuscle, favorite, onToggleFavorite, onOpen }) => {
  const { t } = useTranslation();
  return (
    <Card sx={{ height: '100%', opacity: item.status === STATUS.INACTIVE ? 0.6 : 1, position: 'relative', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
      <CardActionArea onClick={() => onOpen(item.id)} sx={{ p: '16px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <Box sx={{ pr: 5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }} noWrap>{item.name}</Typography>
          {showMuscle && <Typography sx={{ fontSize: 14, color: 'text.secondary' }} noWrap>{muscleLabel(item.muscle)}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
          <Typography sx={{ ...statNumber, fontSize: 22 }}>{formatValue(t, item.mode, item.last.value)}</Typography>
          {item.recentPR && <Chip size="small" variant="outlined" label={t('progress.pr')} sx={{ height: 22, fontSize: 13, fontWeight: 600 }} />}
        </Box>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25 }}>{t(`progress.kind.${item.mode}`)}</Typography>
        <Box sx={{ mt: 1.5 }}><Spark item={item} w={240} h={36} /></Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, gap: 1 }}>
          <Delta item={item} />
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('progress.last_session', { when: formatDaysAgo(t, item.lastDays) })}</Typography>
        </Box>
      </CardActionArea>
      <Star item={item} favorite={favorite} onToggleFavorite={onToggleFavorite} sx={{ position: 'absolute', top: 4, right: 4 }} />
    </Card>
  );
};

const VariantA = ({ favoriteItems, sections, isOpen, onToggle, label, cardProps }) => {
  const { t } = useTranslation();
  const grid = (items, showMuscle) => (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={12} sm={6} md={4} key={item.id}><CardA item={item} showMuscle={showMuscle} {...cardProps(item)} /></Grid>
      ))}
    </Grid>
  );
  return (
    <>
      {favoriteItems.length > 0 && (
        <Grid item xs={12}>
          <Typography variant="cardTitle" sx={{ mb: 1.5 }}>{t('progress.favorites')}</Typography>
          {grid(favoriteItems, true)}
        </Grid>
      )}
      {sections.map((section, index) => (
        <Grid item xs={12} key={section.muscle}>
          <Accordion disableGutters expanded={isOpen(section, index)} onChange={(_, v) => onToggle(section, v)} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}><SectionHeader label={label(section)} section={section} /></AccordionSummary>
            <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>{grid(section.items, false)}</AccordionDetails>
          </Accordion>
        </Grid>
      ))}
    </>
  );
};

// ---------- B: righe dentro la card del gruppo ----------
const RowB = ({ item, showMuscle, favorite, onToggleFavorite, onOpen }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', opacity: item.status === STATUS.INACTIVE ? 0.6 : 1 }}>
      <CardActionArea onClick={() => onOpen(item.id)} sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: 1.25, px: 1, borderRadius: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{item.name}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }} noWrap>
            {showMuscle ? `${muscleLabel(item.muscle)} · ` : ''}{t('progress.last_session', { when: formatDaysAgo(t, item.lastDays) })}
          </Typography>
        </Box>
        <Box sx={{ display: { xs: 'block', md: 'none' } }}><Spark item={item} w={52} h={28} /></Box>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}><Spark item={item} w={160} h={32} /></Box>
        <Box sx={{ textAlign: 'right', minWidth: { xs: 76, md: 120 } }}>
          <Typography sx={{ ...statNumber, fontSize: 18 }}>
            {formatValue(t, item.mode, item.last.value)}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75, alignItems: 'baseline' }}>
            {item.recentPR && <Typography component="span" sx={{ fontSize: 13, fontWeight: 700 }}>{t('progress.pr')}</Typography>}
            <Delta item={item} />
          </Box>
        </Box>
      </CardActionArea>
      <Star item={item} favorite={favorite} onToggleFavorite={onToggleFavorite} />
    </Box>
  );
};

const RowsB = ({ items, showMuscle, cardProps }) => (
  <Box>
    {items.map((item, i) => (
      <Box key={item.id}>
        {i > 0 && <Divider />}
        <RowB item={item} showMuscle={showMuscle} {...cardProps(item)} />
      </Box>
    ))}
  </Box>
);

const VariantB = ({ favoriteItems, sections, isOpen, onToggle, label, cardProps }) => {
  const { t } = useTranslation();
  return (
    <>
      {favoriteItems.length > 0 && (
        <Grid item xs={12}>
          <Card sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', px: { xs: 1, md: 1.5 }, py: 1.5 }}>
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 18, px: 1.5, pb: 0.5 }}>{t('progress.favorites')}</Typography>
            <RowsB items={favoriteItems} showMuscle cardProps={cardProps} />
          </Card>
        </Grid>
      )}
      {sections.map((section, index) => (
        <Grid item xs={12} key={section.muscle}>
          <Accordion disableGutters expanded={isOpen(section, index)} onChange={(_, v) => onToggle(section, v)} sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}><SectionHeader label={label(section)} section={section} /></AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 1, md: 1.5 }, pt: 0, pb: 1 }}><RowsB items={section.items} cardProps={cardProps} /></AccordionDetails>
          </Accordion>
        </Grid>
      ))}
    </>
  );
};

// ---------- C: un elenco unico, filtri per stato, niente grafici ----------
const FILTERS = ['all', STATUS.IMPROVING, STATUS.STALLED, STATUS.DECLINING];
const FILTER_LABEL = { all: 'Tutti', improving: 'In crescita', stalled: 'Fermi', declining: 'In calo' };

const RowC = ({ item, favorite, onToggleFavorite, onOpen }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', opacity: item.status === STATUS.INACTIVE ? 0.6 : 1 }}>
      <CardActionArea
        onClick={() => onOpen(item.id)}
        sx={{ flex: 1, minWidth: 0, py: 1, px: 1, borderRadius: 1, display: 'grid', alignItems: 'baseline', columnGap: 2,
          gridTemplateColumns: { xs: '1fr auto', md: 'minmax(0,1fr) 140px 120px 160px' } }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: 16 }} noWrap>{item.name}</Typography>
        <Typography sx={{ ...statNumber, fontSize: 16, textAlign: 'right' }}>{formatValue(t, item.mode, item.last.value)}</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', display: { xs: 'block', md: 'none' } }} noWrap>
          {t('progress.last_session', { when: formatDaysAgo(t, item.lastDays) })}
        </Typography>
        <Box sx={{ textAlign: 'right' }}>
          {item.recentPR && <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, mr: 0.75 }}>{t('progress.pr')}</Typography>}
          <Delta item={item} />
        </Box>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', display: { xs: 'none', md: 'block' }, textAlign: 'right' }} noWrap>
          {t('progress.last_session', { when: formatDaysAgo(t, item.lastDays) })}
        </Typography>
      </CardActionArea>
      <Star item={item} favorite={favorite} onToggleFavorite={onToggleFavorite} />
    </Box>
  );
};

const VariantC = ({ favoriteItems, sections, label, cardProps }) => {
  const [filter, setFilter] = useState('all');
  const keep = (item) => filter === 'all' || item.status === filter;
  const groups = [
    ...(favoriteItems.length ? [{ key: 'fav', title: 'Preferiti', items: favoriteItems }] : []),
    ...sections.map((s) => ({ key: s.muscle, title: label(s), items: s.items })),
  ].map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length);
  return (
    <Grid item xs={12}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={FILTER_LABEL[f]}
            onClick={() => setFilter(f)}
            sx={filter === f
              ? { bgcolor: 'text.primary', color: 'background.paper', fontSize: 14, '&:hover': { bgcolor: 'text.primary' } }
              : { bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', fontSize: 14 }}
          />
        ))}
      </Box>
      <Card sx={{ boxShadow: 'none', border: '1px solid', borderColor: 'divider', px: { xs: 1, md: 1.5 }, py: 1 }}>
        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(0,1fr) 140px 120px 160px 44px', columnGap: 2, px: 1, py: 1 }}>
          {['Esercizio', '1RM stimato', 'Variazione', 'Ultima sessione', ''].map((h, i) => (
            <Typography key={h || i} sx={{ fontSize: 14, color: 'text.secondary', textAlign: i === 0 ? 'left' : 'right' }}>{h}</Typography>
          ))}
        </Box>
        {groups.map((g) => (
          <Box key={g.key}>
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 14, color: 'text.secondary', px: 1, pt: 1.5, pb: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
              {g.title}
            </Typography>
            {g.items.map((item) => <RowC key={`${g.key}-${item.id}`} item={item} {...cardProps(item)} />)}
          </Box>
        ))}
      </Card>
    </Grid>
  );
};

export const ExerciseVariants = { A: VariantA, B: VariantB, C: VariantC };
