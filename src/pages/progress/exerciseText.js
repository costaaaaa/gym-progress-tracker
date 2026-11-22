// «1° esercizio»: solo se la sessione ha la posizione nella seduta; altrimenti non c'è nulla da mostrare
export const positionLabel = (t, position) => (Number.isInteger(position) ? t('progress.position', { count: position, ordinal: true }) : null);
