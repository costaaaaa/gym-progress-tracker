// Tab neutri: attivo in inchiostro con indicatore da 2px, il rosso del marchio non c'è.
// Stile da telefono come base (le tab si dividono la riga, l'icona sparisce, il testo può andare a capo
// ma non si taglia); da sm tab a larghezza del contenuto, con l'icona.
export const INK_TABS = {
  TabIndicatorProps: { sx: { height: 2, bgcolor: 'text.primary' } },
  sx: (theme) => ({
    minHeight: 0,
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: 16,
      fontWeight: 500,
      minHeight: 44,
      minWidth: 0,
      flexShrink: 1,
      flexGrow: 1,
      px: 1,
      lineHeight: 1.25,
      color: 'text.secondary',
      '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
      '& .MuiTab-iconWrapper': { color: 'text.secondary', display: 'none' },
      [theme.breakpoints.up('sm')]: {
        flexGrow: 0,
        px: 2,
        '& .MuiTab-iconWrapper': { display: 'inline-flex' },
      },
    },
  }),
};
