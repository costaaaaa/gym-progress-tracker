# tier.sh — porta gli account di prova a Plus nei test di shell che creano account Gratis e superano i
# limiti del livello (2 schede, 4 giorni, 10 esercizi personali) o leggono il dashboard completo (stato
# muscolare con percentuale, serie per muscolo). Da includere con `source`, non da eseguire.
#
# Serve DB_SQL_CMD, come in admin_tiers.sh: un comando che legge SQL da stdin sul database dell'istanza
# provata, per esempio
#   DB_SQL_CMD='docker exec -i -e MYSQL_PWD=... db mysql -uroot gym_progress_tracker'
# Gli account di prova sono cancellati dallo script con user/delete.php: il livello sparisce con loro.

# Esce con 2 e un errore chiaro se DB_SQL_CMD manca: da chiamare prima di creare account
need_db_sql_cmd() {
    if [[ -z "${DB_SQL_CMD:-}" ]]; then
        echo "Questo test porta gli account di prova a Plus (limiti del livello Gratis): imposta DB_SQL_CMD" >&2
        echo "  (comando che legge SQL da stdin sul database dell'istanza, vedi tests/lib/tier.sh)." >&2
        exit 2
    fi
}

# plus_account <nome utente>...: imposta tier = plus senza scadenza (SQL diretto)
plus_account() {
    need_db_sql_cmd
    local user
    for user in "$@"; do
        [[ "$user" =~ ^[A-Za-z0-9_]+$ ]] || { echo "plus_account: nome utente non valido: $user" >&2; exit 2; }
        echo "UPDATE gym_users SET tier = 'plus', tier_until = NULL WHERE username = '$user'" | bash -c "$DB_SQL_CMD" \
            || { echo "plus_account: impossibile portare $user a Plus (DB_SQL_CMD sbagliato?)" >&2; exit 2; }
    done
}
