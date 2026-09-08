<?php
/**
 * TISANATURE — api/clients.php
 *
 *  GET ?action=list  → Clients agrégés depuis les commandes
 */

require_once __DIR__ . '/../config/session.php';

startSession();
apiHeaders();
requireAuthAPI();

$pdo    = getPDO();
$action = $_GET['action'] ?? 'list';

/* ══════════════════════════════════════════════════
   LIST — agrégation depuis la table orders
══════════════════════════════════════════════════ */
if ($action === 'list') {

    try {
        $rows = $pdo->query("
            SELECT
                customer_name    AS client_name,
                customer_phone   AS client_phone,
                customer_address AS client_address,
                COUNT(*)                  AS order_count,
                SUM(total)                AS total_spent,
                MAX(created_at)           AS last_order_at
            FROM orders
            WHERE customer_name  IS NOT NULL
              AND customer_name  <> ''
              AND customer_phone IS NOT NULL
              AND customer_phone <> ''
            GROUP BY customer_phone, customer_name, customer_address
            ORDER BY total_spent DESC
        ")->fetchAll();

        $clients = array_map(function($c) {
            return [
                'client_name'    => $c['client_name'],
                'client_phone'   => $c['client_phone'],
                'client_address' => $c['client_address'] ?? '',
                'order_count'    => (int)   $c['order_count'],
                'total_spent'    => (float) $c['total_spent'],
                'last_order_at'  => $c['last_order_at'],
            ];
        }, $rows);

        echo json_encode([
            'success' => true,
            'clients' => $clients,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    } catch (PDOException $e) {
        error_log('[TISANATURE][clients/list] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur serveur.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Action inconnue.'], JSON_UNESCAPED_UNICODE);
exit;