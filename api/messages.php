<?php
/**
 * TISANATURE — api/messages.php  (Administration)
 *
 *  GET  ?action=conversations  → Liste des conversations
 *  GET  ?action=conv&id=X      → Messages d'une conversation
 *  POST ?action=reply          { "conversation_id": X, "content": "..." }
 *  POST ?action=mark_read      { "id": X }
 *  GET  ?action=unread_count   → Nombre de conversations non lues
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

startSession();
apiHeaders();
requireAuthAPI();

$pdo    = getPDO();
$action = $_GET['action'] ?? 'conversations';
$method = $_SERVER['REQUEST_METHOD'];

/* ══════════════════════════════════════════════════════════
   CONVERSATIONS
══════════════════════════════════════════════════════════ */
if ($action === 'conversations') {

    try {
        $stmt = $pdo->query("
            SELECT
                c.id,
                c.client_name,
                c.client_phone,
                c.last_message_at,
                c.is_read_admin,
                (SELECT content FROM messages
                 WHERE conversation_id = c.id
                 ORDER BY id DESC LIMIT 1) AS last_message
            FROM conversations c
            ORDER BY c.last_message_at DESC
        ");

        $rows = array_map(fn($c) => [
            'id'              => (int) $c['id'],
            'client_name'     => $c['client_name'],
            'client_phone'    => $c['client_phone'],
            'last_message_at' => $c['last_message_at'],
            'last_message'    => $c['last_message'] ?? '',
            'unread_count'    => (int) !$c['is_read_admin'], // compatibilité admin.js
        ], $stmt->fetchAll());

        jsonOk(['conversations' => $rows]);

    } catch (PDOException $e) {
        error_log('[TN][messages/conversations] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   CONV — messages d'une conversation
══════════════════════════════════════════════════════════ */
if ($action === 'conv') {

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonErr('ID manquant.', 422);

    try {
        $stmt = $pdo->prepare("
            SELECT id, conversation_id, sender, content, is_read, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        ");
        $stmt->execute([$id]);

        $msgs = array_map(fn($m) => [
            'id'              => (int)  $m['id'],
            'conversation_id' => (int)  $m['conversation_id'],
            'sender'          => $m['sender'],
            'content'         => $m['content'],
            'is_read'         => (bool) $m['is_read'],
            'created_at'      => $m['created_at'],
        ], $stmt->fetchAll());

        jsonOk(['messages' => $msgs]);

    } catch (PDOException $e) {
        error_log('[TN][messages/conv] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   REPLY
══════════════════════════════════════════════════════════ */
if ($action === 'reply') {

    if ($method !== 'POST') jsonErr('Méthode non autorisée.', 405);

    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $convId  = (int)($body['conversation_id'] ?? 0);
    $content = trim((string)($body['content'] ?? ''));

    if ($convId <= 0)      jsonErr('conversation_id requis.', 422);
    if ($content === '')   jsonErr('Le message ne peut pas être vide.', 422);
    if (mb_strlen($content) > 4000) jsonErr('Message trop long (max 4000 caractères).', 422);

    // Vérifier que la conversation existe
    $stmt = $pdo->prepare('SELECT id FROM conversations WHERE id = ? LIMIT 1');
    $stmt->execute([$convId]);
    if (!$stmt->fetch()) jsonErr('Conversation introuvable.', 404);

    try {
        $pdo->beginTransaction();

        $pdo->prepare("
            INSERT INTO messages (conversation_id, sender, content, is_read, created_at)
            VALUES (?, 'admin', ?, 1, NOW())
        ")->execute([$convId, $content]);

        $msgId = (int)$pdo->lastInsertId();

        $pdo->prepare("
            UPDATE conversations
            SET last_message_at = NOW(), is_read_admin = 1
            WHERE id = ?
        ")->execute([$convId]);

        $pdo->commit();

        // Retourner le message créé
        $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? LIMIT 1');
        $stmt->execute([$msgId]);
        $msg  = $stmt->fetch();

        jsonOk([
            'message' => [
                'id'              => (int)  $msg['id'],
                'conversation_id' => (int)  $msg['conversation_id'],
                'sender'          => $msg['sender'],
                'content'         => $msg['content'],
                'is_read'         => (bool) $msg['is_read'],
                'created_at'      => $msg['created_at'],
            ],
        ]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('[TN][messages/reply] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   MARK_READ
══════════════════════════════════════════════════════════ */
if ($action === 'mark_read') {

    if ($method !== 'POST') jsonErr('Méthode non autorisée.', 405);

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $id   = (int)($body['id'] ?? 0);
    if ($id <= 0) jsonErr('ID manquant.', 422);

    try {
        $pdo->prepare("
            UPDATE messages SET is_read = 1
            WHERE conversation_id = ? AND sender = 'client'
        ")->execute([$id]);

        $pdo->prepare("
            UPDATE conversations SET is_read_admin = 1 WHERE id = ?
        ")->execute([$id]);

        jsonOk([]);

    } catch (PDOException $e) {
        error_log('[TN][messages/mark_read] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   UNREAD_COUNT
══════════════════════════════════════════════════════════ */
if ($action === 'unread_count') {

    try {
        $count = (int)$pdo->query("
            SELECT COUNT(*) FROM conversations WHERE is_read_admin = 0
        ")->fetchColumn();

        jsonOk(['count' => $count]);

    } catch (PDOException $e) {
        error_log('[TN][messages/unread_count] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

jsonErr('Action inconnue.', 404);