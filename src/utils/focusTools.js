// Strumenti della serie del Focus: tre interruttori dell'account, nell'ordine in cui si mostrano.
// Il timer di recupero è `rest_timer_enabled`; tecnica e peso suggerito stanno in `focus_tools`.
// Stesso file nell'app: niente import del web.
export const FOCUS_TOOLS = ['rest_timer', 'technique', 'suggested_weight'];

// Valore scritto di uno strumento in un account o in una risposta del server (stessa forma): il booleano, altrimenti undefined
export const toolValue = (source, tool) => {
  const value = tool === 'rest_timer' ? source?.rest_timer_enabled : source?.focus_tools?.[tool];
  return typeof value === 'boolean' ? value : undefined;
};

// Acceso se l'account non dice il contrario: senza i campi (risposta vecchia o non ancora arrivata) è tutto acceso
export const isToolOn = (account, tool) => toolValue(account, tool) !== false;

// Corpo di update_settings.php per accendere o spegnere uno strumento
export const toolSettingsBody = (tool, on) => (
  tool === 'rest_timer' ? { rest_timer_enabled: on } : { focus_tools: { [tool]: on } }
);

// Cosa cambia nell'account dopo che il server ha salvato `tool` (`saved` = la sua risposta): solo il valore di quello
// strumento, sopra quelli che l'account ha già (con due salvataggi in volo la risposta più vecchia non deve riportare
// indietro l'altro). Senza un elenco nell'account si parte da quello intero del server.
export const accountPatch = (account, tool, saved) => {
  if (tool === 'rest_timer') return { rest_timer_enabled: saved.rest_timer_enabled };
  const tools = account?.focus_tools ? { ...account.focus_tools, [tool]: saved.focus_tools[tool] } : { ...saved.focus_tools };
  return { focus_tools: tools };
};

export const toolsOnCount = (account) => FOCUS_TOOLS.filter((tool) => isToolOn(account, tool)).length;
