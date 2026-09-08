<?php
/**
 * TISANATURE — api/order.php  (v RÉELLE — schéma vérifié screenshot)
 *
 *  Schéma orders RÉEL :
 *    delivery (pas delivery_fee), défaut 2000
 *    status ENUM français : nouvelle/confirmee/expediee/livree/annulee
 *    invoice_token existe, cancel_token existe, subtotal existe
 */

require_once __DIR__ . '/../config/session.php';

apiHeaders();

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

/* Mapping JS (anglais) → DB (français) */
const STATUS_MAP = [
    'new'         => 'nouvelle',
    'confirmed'   => 'confirmee',
    'in_delivery' => 'expediee',
    'delivered'   => 'livree',
    'cancelled'   => 'annulee',
    /* déjà en français → identité */
    'nouvelle'    => 'nouvelle',
    'confirmee'   => 'confirmee',
    'expediee'    => 'expediee',
    'livree'      => 'livree',
    'annulee'     => 'annulee',
];

/* ════════════════════════════════════════════════════════════
   GET : LIST  (admin)
════════════════════════════════════════════════════════════ */
if ($action === 'list' && $method === 'GET') {
    startSession();
    requireAuthAPI();

    $pdo  = getPDO();
    $stmt = $pdo->query("
        SELECT
            id,
            order_ref,
            COALESCE(customer_name,    '') AS customer_name,
            COALESCE(customer_name,    '') AS client_name,
            COALESCE(customer_phone,   '') AS customer_phone,
            COALESCE(customer_phone,   '') AS client_phone,
            COALESCE(customer_address, '') AS customer_address,
            COALESCE(customer_address, '') AS client_address,
            COALESCE(products_json,   '[]') AS products_json,
            COALESCE(products_json,   '[]') AS items,
            COALESCE(subtotal,          0)  AS subtotal,
            COALESCE(delivery,       2000)  AS delivery_fee,
            COALESCE(total,             0)  AS total,
            status,
            note,
            COALESCE(cancel_token,  '')  AS cancel_token,
            COALESCE(invoice_token, '')  AS invoice_token,
            created_at,
            updated_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 1000
    ");

    /* FR→EN pour que le dashboard JS affiche les bons statuts */
    $frToEn = [
        'nouvelle'  => 'new',
        'confirmee' => 'confirmed',
        'expediee'  => 'in_delivery',
        'livree'    => 'delivered',
        'annulee'   => 'cancelled',
    ];

    $orders = $stmt->fetchAll();
    foreach ($orders as &$o) {
        $o['id']     = (int)   $o['id'];
        $o['total']  = (float) $o['total'];
        $o['status'] = $frToEn[$o['status']] ?? $o['status'];
    }
    unset($o);

    echo json_encode(['success' => true, 'orders' => $orders], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ════════════════════════════════════════════════════════════
   POST : UPDATE_STATUS  (admin)
════════════════════════════════════════════════════════════ */
if ($action === 'update_status' && $method === 'POST') {
    startSession();
    requireAuthAPI();

    $body      = json_decode(file_get_contents('php://input'), true) ?? [];
    $id        = (int)($body['id']    ?? 0);
    $statusRaw = trim($body['status'] ?? '');

    /* Accepte anglais (dashboard JS) OU français (ENUM DB) */
    $statusDb = STATUS_MAP[$statusRaw] ?? null;

    if (!$id || $statusDb === null) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Données invalides. Statut reçu : ' . $statusRaw,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        getPDO()
            ->prepare('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?')
            ->execute([$statusDb, $id]);
        echo json_encode(['success' => true, 'message' => 'Statut mis à jour.'], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log('[TN][order/update_status] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur base de données.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

/* ════════════════════════════════════════════════════════════
   POST : DELETE  (admin)
════════════════════════════════════════════════════════════ */
if ($action === 'delete' && $method === 'POST') {
    startSession();
    requireAuthAPI();

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $id   = (int)($body['id'] ?? 0);

    if (!$id) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID invalide.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    getPDO()->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Commande supprimée.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ════════════════════════════════════════════════════════════
   POST : CREATE  (public)
════════════════════════════════════════════════════════════ */
if ($action === 'create' && $method === 'POST') {

    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $name    = trim($body['customer_name']    ?? '');
    $phone   = trim($body['customer_phone']   ?? '');
    $address = trim($body['customer_address'] ?? '');
    $note    = trim($body['note']             ?? '');
    $items   = $body['items'] ?? $body['products'] ?? [];

    $errors = [];
    if ($name    === '') $errors[] = 'Le nom est obligatoire.';
    if ($phone   === '') $errors[] = 'Le téléphone est obligatoire.';
    if ($address === '') $errors[] = "L'adresse est obligatoire.";
    if (empty($items))   $errors[] = 'Le panier est vide.';

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => implode(' | ', $errors)], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $DELIVERY  = 2000; /* défaut réel de la table */
    $subtotal  = 0.0;
    $safeItems = [];

    foreach ($items as $item) {
        $qty   = max(1, (int)($item['qty']   ?? 1));
        $price = (float)($item['price']      ?? 0);
        $iname = mb_substr(trim($item['name'] ?? ''), 0, 200);
        if ($iname === '' || $price <= 0) continue;
        $safeItems[] = ['name' => $iname, 'qty' => $qty, 'price' => $price];
        $subtotal   += $price * $qty;
    }

    if (empty($safeItems)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Aucun article valide.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $total       = $subtotal + $DELIVERY;
    $pdo         = getPDO();
    $ref         = _generateOrderRef($pdo);
    $cancelToken = bin2hex(random_bytes(32));
    $invToken    = bin2hex(random_bytes(16));

    try {
        $pdo->prepare("
            INSERT INTO orders
                (order_ref, customer_name, customer_phone, customer_address,
                 note, products_json, subtotal, delivery, total,
                 status, cancel_token, invoice_token, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'nouvelle', ?, ?, NOW())
        ")->execute([
            $ref, $name, $phone, $address, $note,
            json_encode($safeItems, JSON_UNESCAPED_UNICODE),
            round($subtotal, 2), $DELIVERY, round($total, 2),
            $cancelToken, $invToken,
        ]);

        echo json_encode([
            'success'      => true,
            'message'      => "Commande {$ref} enregistrée.",
            'order_ref'    => $ref,
            'order_id'     => (int)$pdo->lastInsertId(),
            'total'        => round($total, 2),
            'cancel_token' => $cancelToken,
        ], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        error_log('[TN][order/create] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur serveur.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

/* ════════════════════════════════════════════════════════════
   GET : CLIENT_ORDERS  (public — par téléphone)
════════════════════════════════════════════════════════════ */
if ($action === 'client_orders' && $method === 'GET') {

    $phone = trim($_GET['phone'] ?? '');
    if ($phone === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Téléphone requis.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $clean = preg_replace('/[^0-9]/', '', $phone);
    $pdo   = getPDO();

    $stmt = $pdo->prepare("
        SELECT
            id, order_ref,
            COALESCE(products_json, '[]')        AS items,
            COALESCE(subtotal,        0)          AS subtotal,
            COALESCE(delivery,     2000)          AS delivery_fee,
            total,
            status,
            COALESCE(cancel_token, '')            AS cancel_token,
            created_at
        FROM orders
        WHERE REPLACE(REPLACE(REPLACE(customer_phone,' ',''),'-',''),'+','') LIKE ?
           OR customer_phone = ?
        ORDER BY created_at DESC
        LIMIT 20
    ");
    $stmt->execute(['%' . substr($clean, -9), $phone]);

    $orders = array_map(static function ($o) {
        $o['cancel_token_prefix'] = substr($o['cancel_token'] ?? '', 0, 8);
        unset($o['cancel_token']);
        return $o;
    }, $stmt->fetchAll());

    echo json_encode(['success' => true, 'orders' => $orders], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ════════════════════════════════════════════════════════════
   POST : CANCEL  (client — via token)
════════════════════════════════════════════════════════════ */
if ($action === 'cancel' && $method === 'POST') {

    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $ref   = trim((string)($body['order_ref']    ?? ''));
    $token = trim((string)($body['cancel_token'] ?? ''));

    if ($ref === '' || $token === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Référence ou token manquant.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $pdo  = getPDO();
        $stmt = $pdo->prepare("
            SELECT id, status, COALESCE(cancel_token, '') AS cancel_token
            FROM orders WHERE order_ref = ? LIMIT 1
        ");
        $stmt->execute([$ref]);
        $order = $stmt->fetch();

        if (!$order) {
            echo json_encode(['success' => false, 'message' => 'Commande introuvable.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $dbToken = (string)($order['cancel_token'] ?? '');

        if ($dbToken === '' || !hash_equals($dbToken, $token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Token invalide.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!in_array($order['status'], ['nouvelle', 'confirmee'], true)) {
            echo json_encode([
                'success' => false,
                'message' => 'Cette commande ne peut plus être annulée (statut : ' . $order['status'] . ').',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pdo->prepare("UPDATE orders SET status = 'annulee', updated_at = NOW() WHERE id = ?")
            ->execute([$order['id']]);

        echo json_encode(['success' => true, 'message' => 'Commande annulée avec succès.'], JSON_UNESCAPED_UNICODE);

    } catch (PDOException $e) {
        error_log('[TN][order/cancel] ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erreur serveur.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Action inconnue.'], JSON_UNESCAPED_UNICODE);
exit;

function _generateOrderRef(PDO $pdo): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $ref = 'CMD-';
        for ($i = 0; $i < 6; $i++) {
            $ref .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $check = $pdo->prepare('SELECT id FROM orders WHERE order_ref = ? LIMIT 1');
        $check->execute([$ref]);
    } while ($check->fetch());
    return $ref;
}