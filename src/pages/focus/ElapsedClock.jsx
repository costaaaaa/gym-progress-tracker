import { useEffect, useState } from 'react';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Cronometro della fase workout, come ElapsedClock del mobile: ha il suo tick da 1 s, così ogni
// secondo si ridisegna solo questo testo e non tutta la pagina. Il tick cade sul confine di
// secondo rispetto a startTime e si ricalcola a ogni giro: un timer in ritardo non si accumula.
export default function ElapsedClock({ startTime }) {
  const [now, setNow] = useState(() => Date.now());
  const start = startTime ? startTime.getTime() : null;

  useEffect(() => {
    if (!start) return undefined;
    let id = null;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      id = setTimeout(tick, 1000 - ((t - start) % 1000));
    };
    tick();
    return () => clearTimeout(id);
  }, [start]);

  return formatTime(start ? Math.floor((now - start) / 1000) : 0);
}
