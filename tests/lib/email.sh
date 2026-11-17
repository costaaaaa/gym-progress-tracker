# email.sh — porta gli account di prova a «email confermata» nei test di shell che registrano account
# veri e, per qualunque motivo, non possono esserne bloccati (oggi la registrazione crea account non
# confermati; dal giorno 8 ogni richiesta autenticata dà 403 email_unverified). Da includere con `source`,
# non da eseguire. Serve DB_SQL_CMD, come tests/lib/tier.sh (stesso comando, stessi limiti):
#   DB_SQL_CMD='docker exec -i -e MYSQL_PWD=... db mysql -uroot gym_progress_tracker'
# Gli account di prova sono cancellati dallo script con user/delete.php.

source "$(dirname "${BASH_SOURCE[0]}")/tier.sh"

# verified_account <nome utente>...: imposta email_verified_at = adesso (SQL diretto)
verified_account() {
    need_db_sql_cmd
    local user
    for user in "$@"; do
        [[ "$user" =~ ^[A-Za-z0-9_]+$ ]] || { echo "verified_account: nome utente non valido: $user" >&2; exit 2; }
        echo "UPDATE gym_users SET email_verified_at = NOW(), unverified_notice_stage = 0, unverified_notice_at = NULL WHERE username = '$user'" | bash -c "$DB_SQL_CMD" \
            || { echo "verified_account: impossibile confermare l'email di $user (DB_SQL_CMD sbagliato?)" >&2; exit 2; }
    done
}
