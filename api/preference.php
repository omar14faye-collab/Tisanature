<?php
/**
 * TISANATURE -- api/preference.php
 * Sauvegarde des preferences client
 *
 *  POST /api/preference.php
 *  Corps JSON : { confirm, tracking, newsletter, tips, analytics }
 *
 *  Les preferences sont stockees dans users.preferences (colonne JSON TEXT).
 *  La colonne newsletter est egalement mise a jour pour compatibilite.
 *
 *  Schema requis :
 *    ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT NULL;
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();
startClientSession();
requireClientAuthAPI();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Methode non autorisee.', 405);
}

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$allowed = ['confirm', 'tracking', 'newsletter', 'tips', 'analytics'];

$prefs = [];
foreach ($allowed as $key) {
    $prefs[$key] = isset($body[$key]) ? (bool) $body[$key] : false;
}

$newsletter = $prefs['newsletter'] ? 1 : 0;
$userId     = (int) $_SESSION['user_id'];

try {
    $pdo = getPDO();

    /* Mise a jour simultanee de preferences (JSON) et newsletter (colonne dedie) */
    $stmt = $pdo->prepare('
        UPDATE users
        SET preferences = ?,
            newsletter  = ?,
            updated_at  = NOW()
        WHERE id = ?
    ');
    $stmt->execute([
        json_encode($prefs, JSON_UNESCAPED_UNICODE),
        $newsletter,
        $userId,
    ]);

    jsonOk(['message' => 'Preferences enregistrees.']);

} catch (PDOException $e) {
    error_log('[TN][preference] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}