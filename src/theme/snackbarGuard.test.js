// Guardia: ogni avviso (Snackbar) prende la sua posizione da useSnackbarAboveBar, così sul telefono sta sopra la barra in
// basso e non la copre. Un Snackbar nuovo senza sx dell'hook fa fallire questa guardia.
import { describe, it, expect } from 'vitest';
import { sourceOffenders } from '../test/sourceFiles';
import { parseSource, walkAst } from '../test/sourceAst';

const HOOK = 'useSnackbarAboveBar';

// Fuori dalla guardia, perché la barra lì non c'è mai: Focus è a schermo intero e fuori dal Layout, la schermata di
// blocco dell'email sostituisce le pagine e nasconde la barra.
const NO_BAR = ['pages/FocusWorkout.jsx', 'components/EmailVerification/EmailBlockedScreen.jsx'];

const calls = (node) => node?.type === 'CallExpression' && node.callee.name === HOOK;

// Gli Snackbar del file il cui sx non è la chiamata dell'hook né una variabile inizializzata con la chiamata
const unruledSnackbars = (code, rel) => {
  const ruled = new Set();
  const snackbars = [];
  walkAst(parseSource(code, rel), (node) => {
    if (node.type === 'VariableDeclarator' && calls(node.init) && node.id.type === 'Identifier') ruled.add(node.id.name);
    if (node.type === 'JSXOpeningElement' && node.name.name === 'Snackbar') snackbars.push(node);
  });
  return snackbars.flatMap((el) => {
    const sx = el.attributes.find((attr) => attr.type === 'JSXAttribute' && attr.name.name === 'sx')?.value?.expression;
    return calls(sx) || (sx?.type === 'Identifier' && ruled.has(sx.name)) ? [] : [`riga ${code.slice(0, el.start).split('\n').length}`];
  });
};

describe('avvisi sopra la barra in basso', () => {
  it('ogni Snackbar usa useSnackbarAboveBar', () => {
    expect(sourceOffenders(unruledSnackbars, NO_BAR)).toEqual([]);
  });

  it('la guardia riconosce uno Snackbar senza la regola', () => {
    const code = "const A = () => <Snackbar open />; const B = () => { const sx = useSnackbarAboveBar(); return <Snackbar sx={sx} />; };";
    expect(unruledSnackbars(code, 'prova')).toHaveLength(1);
  });
});
