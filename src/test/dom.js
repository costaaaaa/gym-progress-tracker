// Helper comuni dei test di pagina: risposta della fetch finta e colore calcolato di un elemento.
export const json = (data) => ({ ok: true, status: 200, json: async () => data });

export const colorOf = (el) => getComputedStyle(el).color;
