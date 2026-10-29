<?php
// Segnalazioni dei contenuti nei gruppi (DSA art. 16): il nome del gruppo o lo username di un
// membro. target_label è il nome al momento della segnalazione, perché poi può cambiare.
class Report
{
    const TARGETS = array('group_name', 'member');
    const STATUSES = array('open', 'resolved', 'dismissed');
    const REASON_MIN = 10;
    const REASON_MAX = 1000;
    const NOTE_MAX = 500;

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Nuova segnalazione aperta; ritorna l'id
    public function create($reporter_id, $group_id, $target, $target_user_id, $target_label, $reason)
    {
        $stmt = $this->conn->prepare(
            "INSERT INTO gym_reports (reporter_user_id, group_id, target, target_user_id, target_label, reason)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([(int)$reporter_id, (int)$group_id, $target, $target_user_id === null ? null : (int)$target_user_id, $target_label, $reason]);
        return (int)$this->conn->lastInsertId();
    }

    // Elenco per la pagina admin: le aperte dalla più vecchia, le chiuse dalla più recente.
    // group_name è il nome attuale del gruppo (null se eliminato), group_admin_renames quante volte
    // l'admin l'ha già rinominato (per il blocco del nome), reporter lo username di chi segnala.
    public function adminList($status)
    {
        $order = $status === 'open' ? 'r.created_at ASC, r.id ASC' : 'r.decided_at DESC, r.id DESC';
        $stmt = $this->conn->prepare(
            "SELECT r.id, r.group_id, g.name AS group_name, g.admin_renames AS group_admin_renames,
                    r.target, r.target_label, r.reason, r.status,
                    r.decision_note, r.decided_at, r.created_at, u.username AS reporter
             FROM gym_reports r
             LEFT JOIN gym_groups g ON g.id = r.group_id
             LEFT JOIN gym_users u ON u.id = r.reporter_user_id
             WHERE r.status = ?
             ORDER BY $order
             LIMIT 200"
        );
        $stmt->execute([$status]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['group_id'] = $row['group_id'] === null ? null : (int)$row['group_id'];
            $row['group_admin_renames'] = (int)$row['group_admin_renames'];
            $row['created_at'] = server_time_iso($row['created_at']);
            $row['decided_at'] = server_time_iso($row['decided_at']);
        }
        return $rows;
    }

    public function find($id)
    {
        $stmt = $this->conn->prepare("SELECT * FROM gym_reports WHERE id = ? LIMIT 1");
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // Chiude una segnalazione aperta con l'esito (resolved|dismissed) e la motivazione.
    // False se nel frattempo non era più aperta.
    public function close($id, $status, $note)
    {
        $stmt = $this->conn->prepare(
            "UPDATE gym_reports SET status = ?, decision_note = ?, decided_at = NOW() WHERE id = ? AND status = 'open'"
        );
        $stmt->execute([$status, $note, (int)$id]);
        return $stmt->rowCount() === 1;
    }
}
