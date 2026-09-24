<?php
// Gruppi (Livello 1): amici o palestra, codice invito, classifica settimanale.
// Nessuna risposta verso gli altri membri contiene user_id o email: il nome mostrato
// è lo username. La classifica si calcola in lettura, senza scrivere nel database.
require_once __DIR__ . '/../lib/weekly_stats.php';

class Group
{
    const MAX_OWNED = 10;
    const TYPES = array('friends', 'gym');
    const BOARDS = array('week', 'streak', 'level');

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Nome del gruppo pulito, o null se non valido (1-60 caratteri, niente link)
    public static function cleanName($name)
    {
        if (!is_string($name)) return null;
        $name = trim(preg_replace('/\s+/u', ' ', $name));
        $length = mb_strlen($name, 'UTF-8');
        if ($length < 1 || $length > 60) return null;
        if (preg_match('/[\x00-\x1F\x7F<>]/u', $name)) return null;
        if (preg_match('~(https?://|www\.|\b[a-z0-9-]+\.(com|it|net|org|app|io|me|ly|gg)\b)~i', $name)) return null;
        return $name;
    }

    public function countOwned($user_id)
    {
        $stmt = $this->conn->prepare("SELECT COUNT(*) FROM gym_groups WHERE owner_user_id = ?");
        $stmt->execute([(int)$user_id]);
        return (int)$stmt->fetchColumn();
    }

    // Crea il gruppo e la membership owner. Ritorna l'id del gruppo.
    public function create($owner_id, $name, $type)
    {
        $this->conn->beginTransaction();
        try {
            $group_id = null;
            for ($attempt = 0; $attempt < 5 && $group_id === null; $attempt++) {
                try {
                    $stmt = $this->conn->prepare(
                        "INSERT INTO gym_groups (name, type, owner_user_id, invite_code) VALUES (?, ?, ?, ?)"
                    );
                    $stmt->execute([$name, $type, (int)$owner_id, generate_invite_code()]);
                    $group_id = (int)$this->conn->lastInsertId();
                } catch (PDOException $e) {
                    // 23000: codice invito già usato, se ne genera un altro
                    if ($e->getCode() !== '23000') throw $e;
                }
            }
            if ($group_id === null) {
                throw new Exception('Impossibile generare un codice invito univoco');
            }
            $this->conn->prepare(
                "INSERT INTO gym_group_members (group_id, user_id, role, share_level, share_consent_at)
                 VALUES (?, ?, 'owner', 'summary', NOW())"
            )->execute([$group_id, (int)$owner_id]);
            $this->conn->commit();
            return $group_id;
        } catch (Throwable $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function findByCode($code)
    {
        $stmt = $this->conn->prepare(
            "SELECT g.id, g.name, g.type, g.invite_enabled, g.max_members,
                    (SELECT COUNT(*) FROM gym_group_members m WHERE m.group_id = g.id) AS members_count
             FROM gym_groups g WHERE g.invite_code = ? LIMIT 1"
        );
        $stmt->execute([$code]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function find($group_id)
    {
        $stmt = $this->conn->prepare(
            "SELECT g.id, g.name, g.type, g.owner_user_id, g.invite_code, g.invite_enabled, g.max_members, g.created_at,
                    (SELECT COUNT(*) FROM gym_group_members m WHERE m.group_id = g.id) AS members_count
             FROM gym_groups g WHERE g.id = ? LIMIT 1"
        );
        $stmt->execute([(int)$group_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // Ingresso come member/summary. Ritorna 'joined', 'already_member', 'full' o 'closed'.
    public function join($group_id, $user_id)
    {
        $this->conn->beginTransaction();
        try {
            // Blocca la riga del gruppo: due ingressi contemporanei non superano il limite
            $stmt = $this->conn->prepare("SELECT invite_enabled, max_members FROM gym_groups WHERE id = ? FOR UPDATE");
            $stmt->execute([(int)$group_id]);
            $group = $stmt->fetch(PDO::FETCH_ASSOC);

            $result = null;
            if (!$group || !(int)$group['invite_enabled']) {
                $result = 'closed';
            } elseif (group_membership($this->conn, $group_id, $user_id)) {
                $result = 'already_member';
            } else {
                $count = $this->conn->prepare("SELECT COUNT(*) FROM gym_group_members WHERE group_id = ?");
                $count->execute([(int)$group_id]);
                if ((int)$count->fetchColumn() >= (int)$group['max_members']) {
                    $result = 'full';
                } else {
                    $this->conn->prepare(
                        "INSERT INTO gym_group_members (group_id, user_id, role, share_level, share_consent_at)
                         VALUES (?, ?, 'member', 'summary', NOW())"
                    )->execute([(int)$group_id, (int)$user_id]);
                    $result = 'joined';
                }
            }
            $this->conn->commit();
            return $result;
        } catch (Throwable $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function listForUser($user_id)
    {
        $stmt = $this->conn->prepare(
            "SELECT g.id, g.name, g.type, m.role AS my_role, m.joined_at,
                    (SELECT COUNT(*) FROM gym_group_members x WHERE x.group_id = g.id) AS members_count
             FROM gym_group_members m JOIN gym_groups g ON g.id = m.group_id
             WHERE m.user_id = ? ORDER BY m.joined_at DESC"
        );
        $stmt->execute([(int)$user_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map(function ($r) {
            return array(
                'id' => (int)$r['id'],
                'name' => $r['name'],
                'type' => $r['type'],
                'my_role' => $r['my_role'],
                'members_count' => (int)$r['members_count'],
                'joined_at' => $r['joined_at'],
            );
        }, $rows);
    }

    // Membri con i dati della classifica. $can_manage aggiunge il riferimento per rimuoverli.
    public function members($group_id, $viewer_id, $can_manage)
    {
        $stmt = $this->conn->prepare(
            "SELECT m.user_id, u.username, m.role, m.joined_at
             FROM gym_group_members m JOIN gym_users u ON u.id = m.user_id
             WHERE m.group_id = ? ORDER BY FIELD(m.role, 'owner', 'admin', 'coach', 'member'), u.username"
        );
        $stmt->execute([(int)$group_id]);
        $out = array();
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $item = array(
                'username' => $r['username'],
                'role' => $r['role'],
                'joined_at' => $r['joined_at'],
                'is_me' => (int)$r['user_id'] === (int)$viewer_id,
            );
            if ($can_manage) {
                $item['ref'] = group_member_ref($group_id, $r['user_id']);
            }
            $out[] = $item;
        }
        return $out;
    }

    // user_id del membro che corrisponde al riferimento opaco, o null
    public function memberByRef($group_id, $ref)
    {
        if (!is_string($ref) || $ref === '') return null;
        $stmt = $this->conn->prepare("SELECT user_id, role FROM gym_group_members WHERE group_id = ?");
        $stmt->execute([(int)$group_id]);
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (hash_equals(group_member_ref($group_id, $r['user_id']), $ref)) {
                return array('user_id' => (int)$r['user_id'], 'role' => $r['role']);
            }
        }
        return null;
    }

    // Classifica della settimana ISO di $now. Quattro query in tutto, non per membro.
    public function leaderboard($group_id, $viewer_id, $board, DateTime $now)
    {
        $stmt = $this->conn->prepare(
            "SELECT m.user_id, u.username,
                    COALESCE(g.current_streak_weeks, 0) AS current_streak_weeks,
                    g.last_completed_week,
                    COALESCE(g.level, 1) AS level,
                    COALESCE(g.total_xp, 0) AS total_xp
             FROM gym_group_members m
             JOIN gym_users u ON u.id = m.user_id
             LEFT JOIN gym_user_gamification g ON g.user_id = m.user_id
             WHERE m.group_id = ?"
        );
        $stmt->execute([(int)$group_id]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $ids = array_map(function ($m) { return (int)$m['user_id']; }, $members);

        $counts = weekly_workout_counts($this->conn, $ids, $now);
        $goals = weekly_goals($this->conn, $ids);
        $volumes = weekly_volumes($this->conn, $ids, $now);

        $rows = array();
        foreach ($members as $m) {
            $id = (int)$m['user_id'];
            $workouts = $counts[$id];
            $goal = $goals[$id];
            $rows[] = array(
                'username' => $m['username'],
                'is_me' => $id === (int)$viewer_id,
                'workouts' => $workouts,
                'goal' => $goal,
                'adherence' => round(min($workouts / $goal, 1), 2),
                'volume_kg' => (int)round($volumes[$id]),
                'streak_weeks' => effectiveStreakWeeks((int)$m['current_streak_weeks'], $m['last_completed_week'], $now),
                'level' => (int)$m['level'],
                'total_xp' => (int)$m['total_xp'],
            );
        }

        // Chiave di ordinamento: a parità di chiave, stessa posizione
        $key = function ($r) use ($board) {
            if ($board === 'streak') return array($r['streak_weeks']);
            if ($board === 'level') return array($r['level'], $r['total_xp']);
            return array($r['adherence'], $r['workouts']);
        };
        usort($rows, function ($a, $b) use ($key) {
            $cmp = $key($b) <=> $key($a);
            return $cmp !== 0 ? $cmp : strcasecmp($a['username'], $b['username']);
        });
        $rank = 0;
        $previous = null;
        foreach ($rows as $i => &$r) {
            $k = $key($r);
            if ($k !== $previous) {
                $rank = $i + 1;
                $previous = $k;
            }
            $r['rank'] = $rank;
        }
        unset($r);
        return $rows;
    }

    public function rename($group_id, $name)
    {
        $this->conn->prepare("UPDATE gym_groups SET name = ? WHERE id = ?")->execute([$name, (int)$group_id]);
    }

    public function regenerateCode($group_id)
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = generate_invite_code();
            try {
                $this->conn->prepare("UPDATE gym_groups SET invite_code = ? WHERE id = ?")->execute([$code, (int)$group_id]);
                return $code;
            } catch (PDOException $e) {
                if ($e->getCode() !== '23000') throw $e;
            }
        }
        throw new Exception('Impossibile generare un codice invito univoco');
    }

    public function setInvitesEnabled($group_id, $enabled)
    {
        $this->conn->prepare("UPDATE gym_groups SET invite_enabled = ? WHERE id = ?")->execute([$enabled ? 1 : 0, (int)$group_id]);
    }

    public function removeMember($group_id, $user_id)
    {
        $this->conn->prepare("DELETE FROM gym_group_members WHERE group_id = ? AND user_id = ?")
            ->execute([(int)$group_id, (int)$user_id]);
    }

    // Cancella il gruppo; le appartenenze spariscono con ON DELETE CASCADE
    public function delete($group_id)
    {
        $this->conn->prepare("DELETE FROM gym_groups WHERE id = ?")->execute([(int)$group_id]);
    }
}
