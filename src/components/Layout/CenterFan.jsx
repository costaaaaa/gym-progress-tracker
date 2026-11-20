import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Modal, useMediaQuery } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import { fanLayout } from './fanLayout';
import { BAR_HEIGHT, BUTTON_BELOW, CIRCLE, TARGET_WIDTH, LABEL_SPACE } from './barMetrics';
import { radius } from '../../theme/radius';

const ICON = { main: 26, other: 20 };
const STAGGER_MS = 30;

// Ventaglio di tondi sopra il pulsante centrale, su un velo scuro. Finestra modale: il fuoco parte da «Inizia» e resta
// dentro, Esc e il tocco sul velo chiudono. Il pulsante di chiusura sta dove sta il pulsante centrale, che qui sotto è coperto.
const CenterFan = ({ open, onClose, items }) => {
  const { t } = useTranslation();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [shown, setShown] = useState(false);
  // Il fuoco va su «Inizia» una volta sola per apertura (il ref di un ButtonBase viene richiamato a ogni render)
  const focused = useRef(false);
  const focusStart = (node) => {
    if (!node || focused.current) return;
    focused.current = true;
    node.focus();
  };

  useEffect(() => {
    if (!open) {
      focused.current = false;
      setShown(false);
      return undefined;
    }
    const id = setTimeout(() => setShown(true), 20);
    return () => clearTimeout(id);
  }, [open]);

  const positions = fanLayout(items);
  const settled = shown || reduceMotion;

  return (
    <Modal open={open} onClose={onClose} hideBackdrop disableRestoreFocus>
      {/* Ogni tocco (velo, voce, chiusura) arriva qui e chiude; la voce intanto naviga col suo collegamento */}
      <Box
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.center_aria')}
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, outline: 'none' }}
      >
        <Box
          data-testid="fan-veil"
          sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: `${BAR_HEIGHT}px`, bgcolor: 'fan.veil' }}
        />
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: `${BAR_HEIGHT}px` }}>
          {items.map((item, i) => {
            const { x, y } = positions[i];
            const size = item.main ? CIRCLE.main : CIRCLE.other;
            const delay = `${i * STAGGER_MS}ms`;
            return (
              <Box
                key={item.key}
                style={{
                  position: 'absolute',
                  left: '50%',
                  marginLeft: `${x}px`,
                  bottom: `${y}px`,
                  width: 0,
                  height: 0,
                  transform: settled ? 'none' : `translate(${-x}px, ${y + BUTTON_BELOW}px) scale(0.3)`,
                  opacity: settled ? 1 : 0,
                  transition: reduceMotion ? 'none' : `transform 180ms ease-out ${delay}, opacity 180ms ease-out ${delay}`,
                }}
              >
                <ButtonBase
                  component={RouterLink}
                  to={item.to}
                  state={item.state}
                  aria-label={item.label}
                  ref={item.main ? focusStart : undefined}
                  sx={{
                    position: 'absolute',
                    top: -size / 2,
                    left: -TARGET_WIDTH / 2,
                    width: TARGET_WIDTH,
                    height: size + LABEL_SPACE,
                    flexDirection: 'column',
                    gap: '4px',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    borderRadius: radius.lg,
                    color: 'common.white',
                    // Sul velo il contorno scuro del tema non si vede: bianco
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'common.white', outlineOffset: '2px' },
                  }}
                >
                  <Box
                    sx={{
                      width: size,
                      height: size,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: item.main ? 'primary.main' : 'fan.item',
                      color: item.main ? 'common.white' : 'text.primary',
                      boxShadow: item.main ? 'none' : (theme) => `inset 0 0 0 1px ${theme.palette.fan.itemBorder}`,
                    }}
                  >
                    <item.Icon sx={{ fontSize: item.main ? ICON.main : ICON.other }} />
                  </Box>
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 600, lineHeight: '16px', whiteSpace: 'nowrap' }}>
                    {item.shortLabel}
                  </Box>
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
        <ButtonBase
          aria-label={t('nav.center.close')}
          sx={{
            position: 'absolute',
            left: '50%',
            ml: `${-CIRCLE.main / 2}px`,
            bottom: `calc(${BUTTON_BELOW}px + env(safe-area-inset-bottom) / 2)`,
            width: CIRCLE.main,
            height: CIRCLE.main,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'common.white',
            border: '4px solid',
            borderColor: 'background.default',
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'common.white', outlineOffset: '2px' },
          }}
        >
          <CloseIcon sx={{ fontSize: 26 }} />
        </ButtonBase>
      </Box>
    </Modal>
  );
};

export default CenterFan;
