// Posizioni dei tondi del ventaglio, in px rispetto al centro del pulsante centrale: x verso destra,
// y verso l'alto dal bordo basso del velo. «Inizia» (la voce `main`) sta sempre nello stesso punto.
// Le altre voci si prendono nell'ordine dell'elenco: da 2 a 5 voci in tutto; con 4 voci rombo
// («Registra», la prima delle altre, in basso al centro), con 3 e 5 arco simmetrico.
export const START_POSITION = { x: 0, y: 146 };
const BELOW_START = { x: 0, y: 62 };
const THREE_SIDES = [{ x: -82, y: 104 }, { x: 82, y: 104 }];
const DIAMOND_SIDES = [{ x: -84, y: 104 }, { x: 84, y: 104 }];
const FIVE_SLOTS = [{ x: -120, y: 54 }, { x: -60, y: 112 }, { x: 60, y: 112 }, { x: 120, y: 54 }];

const othersSlots = (count) => {
  if (count === 1) return [BELOW_START];
  if (count === 2) return THREE_SIDES;
  if (count === 3) return [BELOW_START, ...DIAMOND_SIDES];
  return FIVE_SLOTS;
};

export const fanLayout = (items) => {
  if (items.length < 2 || items.length > 5) throw new Error(`Il ventaglio ha da 2 a 5 voci, ne ha ${items.length}`);
  const slots = othersSlots(items.length - 1);
  let next = 0;
  return items.map((item) => (item.main ? START_POSITION : slots[next++]));
};
