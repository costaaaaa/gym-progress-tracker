import { Box, ButtonBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { SELECTABLE_TECHNIQUES } from '../../utils/intensityTechniques';
import { techniqueLabel, techniqueShortLabel } from '../../i18n/labels';
import { radius } from '../../theme/radius';

// Riga della tecnica di intensità: quattro celle uguali, una sola scelta; un altro tocco sulla scelta la toglie.
// Il testo è corto per stare su una riga a 320 px; il nome per i lettori di schermo è quello intero.
export default function TechniqueRow({ value, onChange }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box role="group" aria-label={t('focus.technique')}
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.75, mb: 3 }}>
      {SELECTABLE_TECHNIQUES.map((tech) => {
        const selected = value === tech;
        return (
          <ButtonBase key={tech} aria-pressed={selected} aria-label={techniqueLabel(tech)} onClick={() => onChange(selected ? '' : tech)}
            sx={{
              minHeight: 44, minWidth: 0, px: 0.25, borderRadius: radius.md, whiteSpace: 'nowrap',
              fontSize: '0.75rem', fontWeight: selected ? 700 : 500, textAlign: 'center',
              color: selected ? colors.primaryText : colors.textSecondary,
              border: `${selected ? 2 : 1}px solid ${selected ? colors.primary : colors.fieldBorder}`,
              bgcolor: selected ? alpha(colors.primary, 0.12) : 'transparent',
            }}>
            {techniqueShortLabel(tech)}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
