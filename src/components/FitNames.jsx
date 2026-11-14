import { useState, useRef, useLayoutEffect } from 'react';
import { Box } from '@mui/material';

// Nomi separati da " / " su una sola riga: ne mostra quanti ne entrano nella larghezza disponibile
// (misura il testo vero con un elemento nascosto) e chiude con "+N" per gli altri.
// Con un solo nome troppo lungo va in ellissi.
const FitNames = ({ names, sep = ' / ', sepSx, sx }) => {
  const box = useRef(null);
  const probe = useRef(null);
  const [count, setCount] = useState(names.length);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => {
      const avail = el.clientWidth;
      let k = names.length;
      for (; k > 1; k -= 1) {
        probe.current.textContent = `${names.slice(0, k).join(sep)}${k < names.length ? ` +${names.length - k}` : ''}`;
        if (probe.current.offsetWidth <= avail) break;
      }
      setCount(k);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [names, sep]);
  const more = names.length - count;
  return (
    <Box ref={box} sx={{ display: 'flex', minWidth: 0, flex: 1, position: 'relative', ...sx }}>
      <Box ref={probe} aria-hidden sx={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {names.slice(0, count).map((name, i) => (
          <Box component="span" key={`${name}-${i}`}>
            {i > 0 && <Box component="span" sx={sepSx}>{sep}</Box>}{name}
          </Box>
        ))}
      </Box>
      {more > 0 && <Box component="span" sx={{ flexShrink: 0, whiteSpace: 'pre' }}> +{more}</Box>}
    </Box>
  );
};

export default FitNames;
