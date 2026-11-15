import { Box } from '@mui/material';

// Campione di sfondo della foto nella scheda condivisa. Selezione: anello (outline) rosso; focus da tastiera:
// secondo anello nel colore del testo, fuori dal primo, così i due stati si leggono insieme.
export default function BackgroundSwatch({ stops, selected, label, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      sx={(theme) => {
        const ring = { outline: '2px solid', outlineOffset: 0, outlineColor: selected ? theme.palette.primary.main : theme.palette.divider };
        return {
          width: 28, height: 28, p: 0, borderRadius: '50%', cursor: 'pointer',
          background: `linear-gradient(${stops[0]}, ${stops[1]})`,
          border: '2px solid', borderColor: 'background.paper',
          ...ring,
          // Specificità sopra a `button:not(.MuiButtonBase-root):focus-visible` del tema, che sposterebbe l'outline
          '&&:focus-visible': {
            ...ring,
            boxShadow: `0 0 0 4px ${theme.palette.background.paper}, 0 0 0 6px ${theme.palette.text.primary}`,
          },
        };
      }}
    />
  );
}
