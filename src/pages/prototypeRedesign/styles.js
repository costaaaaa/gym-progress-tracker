// PROTOTIPO (da buttare): stili condivisi dalle schermate
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

export const cardSx = { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl, p: 2 };
export const labelSx = { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'text.secondary', textTransform: 'uppercase' };
export const titleSx = { fontFamily: TITLE_FONT_FAMILY, fontWeight: 600 };
export const iconBtnSx = { width: 44, height: 44, border: '1px solid', borderColor: 'divider' };
