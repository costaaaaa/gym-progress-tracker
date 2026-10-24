// Testi sotto la soglia di corpo: ogni elemento con testo proprio, bottoni e tab compresi.
// `exempt` è il selettore CSS di ciò che la regola non copre (chip, badge, assi dei grafici): va scritto in ogni test.
export function textBelow(root, min, exempt = '.MuiChip-root') {
  return [...root.querySelectorAll('*')]
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
    .filter((el) => !el.closest(exempt))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < min)
    .map((el) => `${el.textContent.trim().slice(0, 40)} (${getComputedStyle(el).fontSize})`);
}
