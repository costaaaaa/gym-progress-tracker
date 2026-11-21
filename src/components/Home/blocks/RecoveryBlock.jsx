import { useTranslation } from 'react-i18next';
import BlockShell from './BlockShell';
import BodyVisualizer from '../../BodyVisualizer';
import { groupRecovery } from '../../../utils/recoveryGroups';

// Lo stato muscolare viene dalla dashboard che la Home ha già letto: nessuna chiamata in più. `status` è quello della dashboard.
const RecoveryBlock = ({ status, recovery, detail, large = false }) => {
  const { t } = useTranslation();
  const { canTrain, resting } = groupRecovery(recovery);
  const parts = [];
  if (canTrain.length > 0) parts.push(t('home.block.recovery_ready', { count: canTrain.length }));
  // Da sola la seconda parte dice anche di cosa si parla: «2 muscoli in recupero»
  if (resting.length > 0) parts.push(t(canTrain.length > 0 ? 'home.block.recovery_resting' : 'home.block.recovery_resting_alone', { count: resting.length }));
  return (
    <BlockShell
      title={t('home.block.recovery_title')}
      to="/dashboard?tab=muscles"
      status={status}
      summary={parts.length > 0 ? parts.join(' · ') : t('home.block.recovery_none')}
      large={large}
    >
      <BodyVisualizer recoveryData={recovery} detail={detail} embedded />
    </BlockShell>
  );
};

export default RecoveryBlock;
