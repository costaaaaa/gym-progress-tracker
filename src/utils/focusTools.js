// Strumenti della serie del Focus: tre interruttori dell'account, nell'ordine in cui si mostrano.
// Il timer di recupero è `rest_timer_enabled`; tecnica e peso suggerito stanno in `focus_tools`.
// Stesso file nell'app: niente import del web.
export const FOCUS_TOOLS = ['rest_timer', 'technique', 'suggested_weight'];

// Acceso se l'account non dice il contrario: senza i campi (risposta vecchia o non ancora arrivata) è tutto acceso
export const isToolOn = (account, tool) => (
  tool === 'rest_timer' ? account?.rest_timer_enabled !== false : account?.focus_tools?.[tool] !== false
);

// Corpo di update_settings.php per accendere o spegnere uno strumento
export const toolSettingsBody = (tool, on) => (
  tool === 'rest_timer' ? { rest_timer_enabled: on } : { focus_tools: { [tool]: on } }
);

export const toolsOnCount = (account) => FOCUS_TOOLS.filter((tool) => isToolOn(account, tool)).length;
