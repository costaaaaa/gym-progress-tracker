import { useId } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';
import { groupRecovery } from '../utils/recoveryGroups';
import { STATUS_COLOR, readyLabel } from '../utils/recoveryStatus';

// Una riga: nome, barra di avanzamento del recupero, scritta a destra.
// Larghezze fisse: 104 px per "Quadricipiti", 112 px per "pronto tra N giorni" / "ready in N days".
const MuscleRow = ({ group, status, percent, children }) => (
  <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Typography noWrap sx={{ fontSize: 15, color: 'text.primary', width: 104, flexShrink: 0 }}>
      {muscleLabel(group)}
    </Typography>
    <Box
      role="progressbar"
      aria-label={muscleLabel(group)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? 0}
      sx={{ flex: 1, minWidth: 0, height: 6, borderRadius: '3px', bgcolor: 'divider', overflow: 'hidden' }}
    >
      <Box data-recovery-bar sx={{ height: '100%', width: `${percent ?? 0}%`, bgcolor: STATUS_COLOR[status], borderRadius: '3px' }} />
    </Box>
    <Box sx={{ width: 112, flexShrink: 0, textAlign: 'right' }}>{children}</Box>
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

const BodyVisualizer = ({ recoveryData }) => {
  const { t } = useTranslation();
  const { canTrain, resting, noData } = groupRecovery(recoveryData);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="cardTitle" sx={{ mb: 2 }}>
        {t('recovery.title')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {canTrain.length > 0 && (
          <Block title={t('recovery.can_train')}>
            {canTrain.map((group) => (
              <MuscleRow key={group} group={group} status="PRONTO" percent={100}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'recovery.ready' }}>{t('recovery.ready')}</Typography>
              </MuscleRow>
            ))}
          </Block>
        )}
        {resting.length > 0 && (
          <Block title={t('recovery.resting')}>
            {resting.map(({ group, status, percent, days }) => (
              <MuscleRow key={group} group={group} status={status} percent={percent}>
                {days !== null && <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary' }}>{readyLabel(t, days)}</Typography>}
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
