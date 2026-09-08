<?php
/**
 * TISANATURE — api/chat.php  (Widget client — public, sans authentification)
 *
 *  GET  ?action=history&session_id=XXX[&since=ID]  → Historique messages
 *  POST ?action=send  { session_id, content, name, phone }  → Envoyer un message
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();

$pdo    = getPDO();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* ══════════════════════════════════════════════════════════
   HISTORY
══════════════════════════════════════════════════════════ */
if ($action === 'history' && $method === 'GET') {

    $sessionId = trim((string)($_GET['session_id'] ?? ''));
    $since     = max(0, (int)($_GET['since'] ?? 0));

    if ($sessionId === '') {
        jsonOk(['messages' => []]);
    }

    try {
        $stmt = $pdo->prepare('SELECT id FROM conversations WHERE session_id = ? LIMIT 1');
        $stmt->execute([$sessionId]);
        $conv = $stmt->fetch();

        if (!$conv) {
            jsonOk(['messages' => []]);
        }

        $stmt = $pdo->prepare("
            SELECT id, sender, content, created_at
            FROM messages
            WHERE conversation_id = ? AND id > ?
            ORDER BY id ASC
            LIMIT 50
        ");
        $stmt->execute([$conv['id'], $since]);

        $msgs = array_map(fn($m) => [
            'id'         => (int) $m['id'],
            'sender'     => $m['sender'],
            'content'    => $m['content'],
            'created_at' => $m['created_at'],
        ], $stmt->fetchAll());

        jsonOk(['messages' => $msgs]);

    } catch (PDOException $e) {
        error_log('[TN][chat/history] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   SEND
══════════════════════════════════════════════════════════ */
if ($action === 'send' && $method === 'POST') {

    $body      = json_decode(file_get_contents('php://input'), true) ?? [];
    $sessionId = trim((string)($body['session_id'] ?? ''));
    $content   = trim((string)($body['content']    ?? ''));
    $name      = mb_substr(trim((string)($body['name']  ?? 'Visiteur')), 0, 80);
    $phone     = mb_substr(trim((string)($body['phone'] ?? '')),          0, 30);

    if ($sessionId === '') jsonErr('session_id requis.', 422);
    if ($content   === '') jsonErr('Le message ne peut pas être vide.', 422);
    if (mb_strlen($content) > 2000) jsonErr('Message trop long (max 2000 caractères).', 422);

    // Protection basique anti-spam : max 10 messages/minute par session
    startSession();
    $now     = time();
    $window  = 60;
    $maxMsgs = 10;
    $key     = 'chat_rate_' . md5($sessionId);

    $_SESSION[$key] = array_filter(
        $_SESSION[$key] ?? [],
        fn($t) => ($now - $t) < $window
    );

    if (count($_SESSION[$key]) >= $maxMsgs) {
        jsonErr('Trop de messages envoyés. Attendez une minute.', 429);
    }
    $_SESSION[$key][] = $now;

    try {
        $pdo->beginTransaction();

        // Créer ou récupérer la conversation
        $stmt = $pdo->prepare('SELECT id FROM conversations WHERE session_id = ? LIMIT 1');
        $stmt->execute([$sessionId]);
        $conv = $stmt->fetch();

        if (!$conv) {
            $pdo->prepare("
                INSERT INTO conversations
                    (session_id, client_name, client_phone, last_message_at, is_read_admin, created_at)
                VALUES (?, ?, ?, NOW(), 0, NOW())
            ")->execute([$sessionId, $name, $phone]);
            $convId = (int)$pdo->lastInsertId();
        } else {
            $convId = (int)$conv['id'];
            // Marquer non-lu pour l'admin à chaque nouveau message client
            $pdo->prepare("
                UPDATE conversations
                SET last_message_at = NOW(), is_read_admin = 0
                WHERE id = ?
            ")->execute([$convId]);
        }

        $pdo->prepare("
            INSERT INTO messages (conversation_id, sender, content, is_read, created_at)
            VALUES (?, 'client', ?, 0, NOW())
        ")->execute([$convId, $content]);

        $msgId = (int)$pdo->lastInsertId();
        $pdo->commit();

        jsonOk(['msg_id' => $msgId]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('[TN][chat/send] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

jsonErr('Action inconnue.', 404);