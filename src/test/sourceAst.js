// Aiuto comune alle guardie del tema (colori, raggi): parsing e visita dell'AST dei sorgenti con
// espree, lo stesso parser di ESLint. I commenti non sono nodi dell'albero, quindi non arrivano mai
// ai controlli delle guardie (un hex o un apostrofo in un commento non li confonde).
import { parse } from 'espree';
import { KEYS } from 'eslint-visitor-keys';

// fileName serve solo al messaggio d'errore: un file con un errore di sintassi ferma la guardia e dice quale
export function parseSource(code, fileName = 'frammento') {
  try {
    return parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
  } catch (error) {
    throw new Error(`${fileName}: ${error.message}`, { cause: error });
  }
}

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

// Chiave di una Property o di un JSXAttribute: nome, stringa o numero; null per una chiave calcolata da
// un'espressione ([key], [a.b]) e per ogni altro nodo
export function keyNameOf(node) {
  if (node.type === 'JSXAttribute') return node.name.name;
  if (node.type !== 'Property') return null;
  if (node.key.type === 'Literal') return String(node.key.value);
  return node.computed ? null : node.key.name;
}

// Testo scritto a mano: una stringa letterale o il pezzo fisso di un template; null per il resto
export function staticTextOf(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateElement') return node.value.cooked ?? '';
  return null;
}
