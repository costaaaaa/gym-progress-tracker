import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Prima introduzione di ESLint nel repo (in precedenza c'era solo un blocco
 * "eslintConfig" morto ereditato da Create React App, che estendeva
 * "react-app" senza avere il pacchetto installato). Su una codebase mai
 * passata da un linter, tutto e' impostato come "warn": va segnalato, non
 * bloccare il build finche' non viene ripulito a mano file per file.
 *
 * Tutto e' ristretto esplicitamente a "files: src/**" (niente blocco globale
 * senza "files") — il repo contiene cartelle gitignorate ma non escluse di
 * default da ESLint 9 (.claude/, backend_v2/, build/...), inclusa una vecchia
 * worktree con dentro una copia del build minificato: senza il vincolo
 * esplicito su "files", ESLint le attraversa comunque e produce centinaia di
 * falsi positivi su codice generato/di terze parti.
 */
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Solo le due regole "classiche" sugli hook: eslint-plugin-react-hooks
      // v7 ne aggiunge una decina in piu' orientate al React Compiler
      // (immutability, purity, static-components...), quasi tutte a "error"
      // di default — fuori scope qui, e su una codebase mai lintata avrebbero
      // prodotto rumore non pertinente al problema che vogliamo intercettare.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      // "recommended" li mette a "error": al primo run hanno intercettato 7
      // casi tutti innocui nel loro contesto (hasOwnProperty diretto su
      // oggetti letterali, catch vuoto per ignorare la cancellazione di
      // navigator.share) — declassati a warning per non bloccare, coerente
      // col resto di questa config. Da rivalutare file per file, non qui.
      'no-prototype-builtins': 'warn',
      'no-empty': 'warn',
      // Guardia contro la temporal dead zone negli array di dipendenze degli
      // hook: "}, [fetchX]);" scritto sopra "const fetchX = useCallback(...)"
      // viene valutato durante il render e lancia ReferenceError a runtime,
      // mentre build e exhaustive-deps non se ne accorgono (e' gia' successo
      // in Progress.jsx). Con "variables: false" segnala solo gli usi nello
      // stesso scope prima della dichiarazione, non quelli dentro callback
      // (es. il corpo di un useEffect), che sono legittimi.
      'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
    },
  },
  // Il font dei titoli sta in un punto solo: src/utils/fonts.js (costante) e il tema (varianti h1-h6, cardTitle).
  // Vietato scrivere "Lexend" in stringhe e template altrove. Esclusi il canvas del cartoncino (usa un font
  // canvas con fallback suo) e i test, che tengono il valore atteso scritto per esteso.
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/utils/fonts.js', 'src/utils/renderShareCard.js', 'src/**/*.test.{js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/Lexend/]',
          message: 'Non scrivere "Lexend" a mano: usa TITLE_FONT_FAMILY da utils/fonts.js, oppure la variante cardTitle del tema.',
        },
        {
          selector: 'TemplateElement[value.raw=/Lexend/]',
          message: 'Non scrivere "Lexend" a mano: usa TITLE_FONT_FAMILY da utils/fonts.js, oppure la variante cardTitle del tema.',
        },
      ],
    },
  },
];
