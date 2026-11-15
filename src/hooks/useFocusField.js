import { useEffect, useRef, useState } from 'react';

// Porta il focus sul campo sbagliato dopo che l'errore è stato disegnato: il lettore di schermo legge così
// anche il messaggio collegato con aria-describedby. `fieldRef(name)` va passato come ref/inputRef del
// campo; `focusField(name)` chiede il focus (anche due volte di fila sullo stesso campo).
export default function useFocusField() {
  const refs = useRef({});
  const [request, setRequest] = useState(null);
  useEffect(() => {
    if (request) refs.current[request.name]?.focus();
  }, [request]);
  return {
    fieldRef: (name) => (el) => { refs.current[name] = el; },
    focusField: (name) => setRequest({ name }),
  };
}
