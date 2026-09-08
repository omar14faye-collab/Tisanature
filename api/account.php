<?php
/**
 * TISANATURE — api/account.php  (v RÉELLE — schéma vérifié screenshot)
 *
 * Schéma orders RÉEL :
 *   id, user_id, order_ref, customer_name, customer_phone, customer_address,
 *   products_json, subtotal, delivery (défaut 2000), total,
 *   status ENUM('nouvelle','confirmee','expediee','livree','annulee'),
 *   note, invoice_token, created_at, updated_at, cancel_token
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

startClientSession();
apiHeaders();
requireClientAuthAPI();

$pdo = getPDO();
$uid = (int)$_SESSION['user_id'];

/* ══════════════════════════════════════════════════════════
   1. Données utilisateur
══════════════════════════════════════════════════════════ */
try {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $user = $stmt->fetch();

    if (!$user) {
        session_destroy();
        jsonErr('Session invalide.', 401);
    }

    if (array_key_exists('is_active', $user) && !(int)$user['is_active']) {
        session_destroy();
        jsonErr('Compte désactivé.', 401);
    }

} catch (PDOException $e) {
    error_log('[TN][account/user] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}

/* ══════════════════════════════════════════════════════════
   2. Commandes du client
══════════════════════════════════════════════════════════ */
$orders = [];
try {
    $phone = (string)($user['phone'] ?? '');
    $name  = (string)($user['name']  ?? '');

    $rawPhone   = preg_replace('/[^0-9]/', '', $phone);
    $shortPhone = strlen($rawPhone) >= 9 ? substr($rawPhone, -9) : $rawPhone;

    $conditions = [];
    $params     = [];

    if ($shortPhone !== '') {
        $conditions[] = "REPLACE(REPLACE(REPLACE(customer_phone,' ',''),'-',''),'+','') LIKE ?";
        $params[]     = '%' . $shortPhone;
    }
    if ($phone !== '') {
        $conditions[] = 'customer_phone = ?';
        $params[]     = $phone;
    }
    if ($name !== '') {
        $conditions[] = 'customer_name = ?';
        $params[]     = $name;
    }

    if (!empty($conditions)) {
        $sql = "
            SELECT
                id,
                order_ref,
                COALESCE(products_json,    '[]') AS products_json,
                COALESCE(subtotal,            0) AS subtotal,
                COALESCE(delivery,         2000) AS delivery_fee,
                COALESCE(total,               0) AS total,
                status,
                COALESCE(note,              '') AS note,
                COALESCE(customer_name,     '') AS customer_name,
                COALESCE(customer_phone,    '') AS customer_phone,
                COALESCE(customer_address,  '') AS customer_address,
                COALESCE(cancel_token, invoice_token, '') AS cancel_token,
                created_at
            FROM orders
            WHERE " . implode(' OR ', $conditions) . "
            ORDER BY created_at DESC
            LIMIT 50
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        /* ENUM français */
        $cancellableStatuses = ['nouvelle', 'confirmee'];
        $seen = [];

        foreach ($stmt->fetchAll() as $row) {
            if (isset($seen[$row['id']])) continue;
            $seen[$row['id']] = true;

            $items = [];
            try {
                $raw = json_decode((string)$row['products_json'], true, 512, JSON_THROW_ON_ERROR);
                if (is_array($raw)) $items = $raw;
            } catch (\JsonException $e) {}

            $label = implode(', ', array_map(
                fn($i) => ($i['name'] ?? '?') . ' ×' . ($i['qty'] ?? 1),
                array_slice($items, 0, 3)
            ));
            if (count($items) > 3) $label .= '…';

            $statusDb = (string)$row['status'];
            $statusJs = _mapStatus($statusDb);

            $orders[] = [
                'id'               => (int)   $row['id'],
                'ref'              => (string) $row['order_ref'],
                'items_label'      => $label ?: '—',
                'items'            => $items,
                'date'             => date('d/m/Y', strtotime($row['created_at'])),
                'amount'           => (float)  $row['total'],
                'subtotal'         => (float)  $row['subtotal'],
                'delivery_fee'     => (float)  $row['delivery_fee'],
                'status'           => $statusJs,
                'cancellable'      => in_array($statusDb, $cancellableStatuses, true),
                'cancel_token'     => (string) $row['cancel_token'],
                'note'             => (string) $row['note'],
                'customer_name'    => (string)($user['name']    ?? $row['customer_name']),
                'customer_phone'   => (string)($user['phone']   ?? $row['customer_phone']),
                'customer_address' => (string)($user['address'] ?? $row['customer_address']),
            ];
        }
    }

} catch (PDOException $e) {
    error_log('[TN][account/orders] ' . $e->getMessage());
}

/* ══════════════════════════════════════════════════════════
   3. Préférences
══════════════════════════════════════════════════════════ */
$preferences = [];
try {
    $raw = $user['preferences'] ?? null;
    if ($raw) {
        $decoded = json_decode((string)$raw, true);
        if (is_array($decoded)) $preferences = $decoded;
    }
} catch (\Throwable $e) {}

foreach (['confirm' => true, 'tracking' => true, 'newsletter' => false,
          'tips' => false, 'analytics' => false] as $k => $v) {
    if (!array_key_exists($k, $preferences)) $preferences[$k] = $v;
}

/* ══════════════════════════════════════════════════════════
   Réponse
══════════════════════════════════════════════════════════ */
jsonOk([
    'user' => [
        'id'      => (int)   ($user['id']      ?? 0),
        'name'    => (string)($user['name']     ?? ''),
        'email'   => (string)($user['email']    ?? ''),
        'phone'   => (string)($user['phone']    ?? ''),
        'address' => (string)($user['address']  ?? ''),
        'city'    => (string)($user['city']     ?? 'Dakar'),
        'zone'    => (string)($user['zone']     ?? ''),
    ],
    'orders'      => $orders,
    'preferences' => $preferences,
]);

/* ══════════════════════════════════════════════════════════
   Helper : statut DB (français) → JS (anglais)
══════════════════════════════════════════════════════════ */
function _mapStatus(string $s): string
{
    return match($s) {
        'nouvelle'  => 'new',
        'confirmee' => 'confirmed',
        'expediee'  => 'in_delivery',
        'livree'    => 'delivered',
        'annulee'   => 'cancelled',
        default     => 'new',
    };
}