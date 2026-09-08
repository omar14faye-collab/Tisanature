<?php
/**
 * TISANATURE — api/settings.php
 *
 *  GET  ?action=get   → Lire tous les paramètres
 *  POST ?action=save  { site_name, phone, delivery_fee, whatsapp, instagram, address }
 */

require_once __DIR__ . '/../config/session.php';

startSession();
apiHeaders();
requireAuthAPI();

$pdo    = getPDO();
$action = $_GET['action'] ?? 'get';
$method = $_SERVER['REQUEST_METHOD'];

/* ══════════════════════════════════════════════════
   GET
══════════════════════════════════════════════════ */
if ($action === 'get') {

    try {
        $rows     = $pdo->query('SELECT `key`, `value` FROM settings')->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['key']] = $row['value'];
        }

        // Valeurs par défaut si la table est vide
        $defaults = [
            'site_name'    => 'TISANATURE',
            'phone'        => '',
            'delivery_fee' => '3000',
            'whatsapp'     => '',
            'instagram'    => '@tisanature',
            'address'      => 'Dakar, Sénégal',
        ];
        foreach ($defaults as $k => $v) {
            if (!isset($settings[$k])) $settings[$k] = $v;
        }

        echo json_encode(['success' => true, 'settings' => $settings], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        error_log('[TISANATURE][settings/get] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur serveur.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

/* ══════════════════════════════════════════════════
   SAVE
══════════════════════════════════════════════════ */
if ($action === 'save' && $method === 'POST') {

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $allowed = ['site_name', 'phone', 'delivery_fee', 'whatsapp', 'instagram', 'address'];

    try {
        $stmt = $pdo->prepare("
            INSERT INTO settings (`key`, `value`)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)
        ");

        foreach ($allowed as $key) {
            if (isset($body[$key])) {
                $stmt->execute([$key, (string)$body[$key]]);
            }
        }

        echo json_encode(['success' => true, 'message' => 'Paramètres sauvegardés.'], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        error_log('[TISANATURE][settings/save] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur serveur.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Action inconnue.'], JSON_UNESCAPED_UNICODE);
exit;