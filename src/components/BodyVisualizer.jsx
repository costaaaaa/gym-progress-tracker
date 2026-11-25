import { useId } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';
import { groupRecovery } from '../utils/recoveryGroups';
import { STATUS_COLOR, readyLabel } from '../utils/recoveryStatus';
import LockedRow from './LockedRow';
import BasicMuscleRow from './BasicMuscleRow';

// Una riga: nome, barra di avanzamento del recupero, scritta a destra.
// Larghezze fisse: 104 px per "Quadricipiti", 112 px per "Pronto tra N giorni" / "Ready in N days".
// `stacked`: sul telefono, dove le due colonne fisse non lasciano posto alla barra, nome e scritta stanno su una riga
// e la barra sotto, larga quanto la riga.
const MuscleRow = ({ group, status, percent, stacked = false, children }) => (
  <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ...(stacked && { flexWrap: { xs: 'wrap', sm: 'nowrap' }, rowGap: 0.75 }) }}>
    <Typography noWrap sx={{ fontSize: 15, color: 'text.primary', ...(stacked ? { width: { xs: 'auto', sm: 104 }, flex: { xs: '1 1 0', sm: '0 0 auto' }, minWidth: 0 } : { width: 104, flexShrink: 0 }) }}>
      {muscleLabel(group)}
    </Typography>
    <Box
      role="progressbar"
      aria-label={muscleLabel(group)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? 0}
      sx={{ flex: 1, minWidth: 0, height: 6, borderRadius: '3px', bgcolor: 'divider', overflow: 'hidden', ...(stacked && { order: { xs: 1, sm: 0 }, flexBasis: { xs: '100%', sm: 0 } }) }}
    >
      <Box data-recovery-bar sx={{ height: '100%', width: `${percent ?? 0}%`, bgcolor: STATUS_COLOR[status], borderRadius: '3px' }} />
    </Box>
    <Box sx={{ width: stacked ? { xs: 'auto', sm: 112 } : 112, flexShrink: 0, textAlign: 'right' }}>{children}</Box>
  </Box>
);

const Block = ({ title, children }) => {
  const titleId = useId();
  return (
    <Box>
      <Typography id={titleId} sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 1.25 }}>
        {title}
      </Typography>
      <Box component="ul" aria-labelledby={titleId} sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {children}
      </Box>
    </Box>
  );
};

// detail: "full" (percentuale e giorni mancanti, com'è sempre stato) o "basic" (solo pronto / in recupero).
// embedded: dentro un blocco che ha già il suo titolo (Home): niente titolo proprio e, sul telefono, la barra sotto il nome.
const BodyVisualizer = ({ recoveryData, detail = 'full', embedded = false }) => {
  const { t } = useTranslation();
  const { canTrain, resting, noData } = groupRecovery(recoveryData);
  const basic = detail === 'basic';

  return (
    <Box sx={{ width: '100%' }}>
      {!embedded && (
        <Typography variant="cardTitle" sx={{ mb: 2 }}>
          {t('recovery.title')}
        </Typography>
      )}
      {basic && <LockedRow>{t('recovery.locked')}</LockedRow>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {canTrain.length > 0 && (
          <Block title={t('recovery.can_train')}>
            {canTrain.map((group) => basic ? <BasicMuscleRow key={group} muscle={group} /> : (
              <MuscleRow key={group} group={group} status="PRONTO" percent={100} stacked={embedded}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'recovery.ready' }}>{t('recovery.ready')}</Typography>
              </MuscleRow>
            ))}
          </Block>
        )}
        {resting.length > 0 && (
          <Block title={t(basic ? 'recovery.basic_resting' : 'recovery.resting')}>
            {resting.map(({ group, status, percent, days }) => basic ? <BasicMuscleRow key={group} muscle={group} /> : (
              <MuscleRow key={group} group={group} status={status} percent={percent} stacked={embedded}>
                {days !== null && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{readyLabel(t, days)}</Typography>}
              </MuscleRow>
            ))}
          </Block>
        )}
        {noData.length > 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {t('recovery.no_data_list', { list: noData.map(muscleLabel).join(', ') })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BodyVisualizer;
