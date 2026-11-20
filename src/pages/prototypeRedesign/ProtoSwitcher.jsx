// PROTOTIPO (da buttare): pannello delle opzioni, fuori dal disegno. Pillola sul bordo destro, apre l'elenco.
import { useState } from 'react';
import { OPTIONS } from './useProto';

const LABELS = { s: 'Schermata', home: 'Home', stato: 'Home: stato del giorno', menu: 'Menu centrale', tondi: 'Tondi del ventaglio', logo: 'Logo', moduli: 'Moduli', bozza: 'Bozza', tecniche: 'Tecniche', pari: 'Ventaglio con 2 o 4 voci', strumenti: 'Strumenti', vista: 'Storico: vista', tab: 'Progressi: tab', account: 'Account: forma', tema: 'Tema' };
const SHOWN = { bozza: { 0: 'no', 1: 'sì' } };

const ProtoSwitcher = ({ values, set }) => {
  const [open, setOpen] = useState(false);
  const font = 'system-ui, sans-serif';
  return (
    <div data-prototype-switcher style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 3000, fontFamily: font }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Opzioni del prototipo"
          style={{ writingMode: 'vertical-rl', background: '#000', color: '#fff', border: '2px solid #fff', borderRight: 0, borderRadius: '12px 0 0 12px', padding: '14px 6px', fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}
        >
          PROTOTIPO
        </button>
      )}
      {open && (
        <div style={{ background: '#000', color: '#fff', border: '2px solid #fff', borderRight: 0, borderRadius: '12px 0 0 12px', padding: 12, width: 250, maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Opzioni del prototipo</strong>
            <button type="button" onClick={() => setOpen(false)} style={{ background: '#fff', color: '#000', border: 0, borderRadius: 6, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}>Chiudi</button>
          </div>
          {Object.keys(OPTIONS).map((k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{LABELS[k]}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {OPTIONS[k].map((v) => {
                  const on = values[k] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(k, v)}
                      style={{ background: on ? '#fff' : 'transparent', color: on ? '#000' : '#fff', border: '1px solid #fff', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 36 }}
                    >
                      {SHOWN[k]?.[v] ?? v}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProtoSwitcher;
