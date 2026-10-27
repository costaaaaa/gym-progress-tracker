// Helper comuni dei test di pagina: risposta della fetch finta e colore calcolato di un elemento.
export const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });

export const colorOf = (el) => getComputedStyle(el).color;
