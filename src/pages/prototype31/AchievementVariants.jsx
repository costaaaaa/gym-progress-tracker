// PROTOTIPO #31 D4 (branch usa e getta): tre modi di mostrare i traguardi nel Profilo.
// A = griglia di card neutre, B = una riga per categoria con le tappe, C = prossimi traguardi + elenco degli ottenuti.
import { Box, Card, Grid, LinearProgress, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { intlLocale } from '../../i18n/format';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

export const ACH_VARIANT_NAMES = { A: 'griglia neutra', B: 'tappe per categoria', C: 'prossimi + ottenuti' };

const CATEGORY_ORDER = ['sessions', 'tonnage', 'streak'];
const CATEGORY_LABEL = { sessions: 'Sessioni', tonnage: 'Tonnellaggio', streak: 'Costanza' };
const flatCard = { boxShadow: 'none', border: '1px solid', borderColor: 'divider' };
const fmtDate = (d) => new Date(String(d).replace(' ', 'T')).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (n) => Math.round(n).toLocaleString(intlLocale());

const byCategory = (achievements) => {
  const out = {};
  achievements.forEach((a) => { (out[a.category] = out[a.category] || []).push(a); });
  return CATEGORY_ORDER.filter((c) => out[c]?.length).map((c) => ({ cat: c, items: out[c] }));
};

const Title = () => <Typography variant="cardTitle" sx={{ mb: 2 }}>Traguardi</Typography>;

// ---------- A: griglia di card, neutre (un solo segno rosso: la stella) ----------
const VariantA = ({ data }) => (
  <>
    <Title />
    {byCategory(data.achievements).map(({ cat, items }) => (
      <Box key={cat} sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1.25 }}>{CATEGORY_LABEL[cat]}</Typography>
        <Grid container spacing={1.5}>
          {items.map((a) => (
            <Grid item xs={6} sm={3} key={a.key}>
              <Card sx={{ ...flatCard, borderRadius: '12px', p: '16px 10px', textAlign: 'center', height: '100%' }}>
                {a.locked
                  ? <LockOutlinedIcon sx={{ fontSize: 22, color: 'text.disabled', mb: 0.75 }} />
                  : <StarIcon sx={{ fontSize: 22, color: 'primary.main', mb: 0.75 }} />}
                <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: a.locked ? 'text.secondary' : 'text.primary' }}>{a.label}</Typography>
                {!a.locked && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>{fmtDate(a.unlocked_at)}</Typography>}
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    ))}
  </>
);

// ---------- B: una card per categoria, le tappe come pillole in fila ----------
const VariantB = ({ data }) => (
  <>
    <Title />
    <Card sx={{ ...flatCard, p: { xs: 2, md: 2.5 } }}>
      {byCategory(data.achievements).map(({ cat, items }, i) => {
        const earned = items.filter((a) => !a.locked).length;
        return (
          <Box key={cat} sx={{ pt: i ? 2 : 0, mt: i ? 2 : 0, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
              <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>{CATEGORY_LABEL[cat]}</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{earned} di {items.length}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {items.map((a) => (
                <Box
                  key={a.key}
                  title={a.locked ? `Soglia: ${a.threshold}` : fmtDate(a.unlocked_at)}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.25, borderRadius: 999, fontSize: 14,
                    ...(a.locked
                      ? { border: '1px dashed', borderColor: 'divider', color: 'text.secondary' }
                      : { bgcolor: 'action.selected', color: 'text.primary', fontWeight: 600 }),
                  }}
                >
                  {a.locked ? <LockOutlinedIcon sx={{ fontSize: 16 }} /> : <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                  {a.label}
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Card>
  </>
);

// ---------- C: prima il prossimo traguardo per categoria, poi gli ottenuti con la data ----------
const CURRENT = {
  sessions: (d) => ({ value: d.total_sessions, unit: (v) => `${fmtNum(v)} sessioni` }),
  tonnage: (d) => ({ value: d.lifetime_volume_kg, unit: (v) => `${fmtNum(v)} kg` }),
  streak: (d) => ({ value: d.longest_streak, unit: (v) => `${fmtNum(v)} settimane` }),
};

const VariantC = ({ data }) => {
  const groups = byCategory(data.achievements);
  const next = groups
    .map(({ cat, items }) => ({ cat, a: items.find((x) => x.locked), cur: CURRENT[cat](data) }))
    .filter((n) => n.a);
  const earned = data.achievements.filter((a) => !a.locked).sort((x, y) => String(y.unlocked_at).localeCompare(String(x.unlocked_at)));
  const lockedLeft = data.achievements.filter((a) => a.locked).length - next.length;
  return (
    <>
      <Title />
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...flatCard, p: { xs: 2, md: 2.5 }, height: '100%' }}>
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16, mb: 1.5 }}>Prossimi</Typography>
            {next.map(({ cat, a, cur }, i) => (
              <Box key={cat} sx={{ mt: i ? 2 : 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 600 }} noWrap>{a.label}</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }}>{CATEGORY_LABEL[cat]}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (cur.value / a.threshold) * 100)}
                  sx={{ height: 6, borderRadius: '3px', bgcolor: 'divider', my: 0.75, '& .MuiLinearProgress-bar': { borderRadius: '3px', bgcolor: 'text.primary' } }}
                />
                <Typography sx={{ fontSize: 14, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {cur.unit(cur.value)} di {fmtNum(a.threshold)}
                </Typography>
              </Box>
            ))}
            {lockedLeft > 0 && <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 2 }}>Altri {lockedLeft} dopo questi</Typography>}
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...flatCard, p: { xs: 2, md: 2.5 }, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
              <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>Ottenuti</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{earned.length} di {data.achievements.length}</Typography>
            </Box>
            {earned.map((a, i) => (
              <Box key={a.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
                <StarIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
                <Typography sx={{ fontSize: 16, flex: 1, minWidth: 0 }} noWrap>{a.label}</Typography>
                <Typography sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }}>{fmtDate(a.unlocked_at)}</Typography>
              </Box>
            ))}
          </Card>
        </Grid>
      </Grid>
    </>
  );
};

export const AchievementVariants = { A: VariantA, B: VariantB, C: VariantC };
