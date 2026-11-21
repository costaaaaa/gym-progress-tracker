// Padding verticale di MUI (16.5px), non quello del tema: i campi del Focus restano più alti degli
// altri, in palestra servono bersagli grandi
export const FOCUS_FIELD_PADDING = { paddingTop: '16.5px', paddingBottom: '16.5px' };

// Stile dei campi peso e ripetizioni del Focus (schermata della serie e correzione di una serie fatta): cambia solo
// la dimensione del testo
export const focusFieldSx = (colors, fontSize, extra = {}) => ({
  '& .MuiOutlinedInput-root': { color: colors.text, fontSize, fontWeight: 700, '& fieldset': { borderColor: colors.fieldBorder, borderWidth: 2 } },
  '& .MuiOutlinedInput-input': FOCUS_FIELD_PADDING, '& .MuiInputLabel-root': { color: colors.textSecondary }, ...extra,
});
