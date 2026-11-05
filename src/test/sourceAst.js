// Aiuto comune alle guardie del tema (colori, raggi): parsing e visita dell'AST dei sorgenti con
// espree, lo stesso parser di ESLint. I commenti non sono nodi dell'albero, quindi non arrivano mai
// ai controlli delle guardie (un hex o un apostrofo in un commento non li confonde).
import { parse } from 'espree';
import { KEYS } from 'eslint-visitor-keys';

export const parseSource = (code) => parse(code, {
  ecmaVersion: 'latest',
  sourceType: 'module',
  ecmaFeatures: { jsx: true },
});

// Visita ogni nodo dell'albero (compreso quello di partenza): a "visit" arrivano il nodo e la pila dei
// suoi antenati, dal più vicino al più lontano, senza il nodo stesso.
export function walkAst(node, visit, ancestors = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  const deeper = [node, ...ancestors];
  for (const key of KEYS[node.type] || []) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walkAst(item, visit, deeper);
    } else {
      walkAst(child, visit, deeper);
    }
  }
}
