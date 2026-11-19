// PROTOTIPO (da buttare): pannello che sale dal basso dentro il finto telefono
import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

const Sheet = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      <Box onClick={onClose} sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)' }} />
      <Box
        role="dialog"
        aria-modal="true"
        aria-label={title}
        sx={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', overflowY: 'auto',
          bgcolor: 'background.paper', borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
          p: 2, pb: 3, borderTop: '1px solid', borderColor: 'divider',
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 1.5 }} />
        {title && <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: '1.1rem', mb: 1.5 }}>{title}</Typography>}
        {children}
      </Box>
    </Box>
  );
};

export default Sheet;
