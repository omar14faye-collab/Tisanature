<?php
/**
 * TISANATURE -- api/submit_order.php
 * Endpoint public -- commandes depuis le site vitrine.
 *
 *  METHODE : POST  |  Content-Type : application/json
 *  CORPS :
 *    customer_name    : string (obligatoire)
 *    customer_phone   : string (obligatoire)
 *    customer_address : string (obligatoire)
 *    note             : string (optionnel)
 *    products         : [ { name, price, qty } ]
 *
 *  REPONSE :
 *    { success, order_ref, order_id, invoice_token,
 *      subtotal, delivery, total, customer_name, message }
 */

require_once __DIR__ . '/../config/session.php';

apiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'message' => 'Methode non autorisee.'], JSON_UNESCAPED_UNICODE));
}

/* -- Lecture body -- */
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Corps JSON invalide.'], JSON_UNESCAPED_UNICODE));
}

$customerName    = trim($body['customer_name']    ?? '');
$customerPhone   = trim($body['customer_phone']   ?? '');
$customerAddress = trim($body['customer_address'] ?? '');
$note            = trim($body['note']             ?? '');
$products        = $body['products'] ?? $body['items'] ?? [];

/* -- Validation -- */
$errors = [];
if ($customerName    === '') $errors[] = 'Le nom est obligatoire.';
if ($customerPhone   === '') $errors[] = 'Le telephone est obligatoire.';
if ($customerAddress === '') $errors[] = "L'adresse de livraison est obligatoire.";
if (empty($products))        $errors[] = 'Le panier est vide.';

if (!empty($errors)) {
    http_response_code(422);
    die(json_encode(['success' => false, 'message' => implode(' | ', $errors)], JSON_UNESCAPED_UNICODE));
}

$DELIVERY_FEE  = 3000;
$subtotal      = 0.0;
$productsClean = [];

foreach ($products as $item) {
    $iname = mb_substr(trim($item['name'] ?? ''), 0, 200);
    $price = (float)($item['price'] ?? 0);
    $qty   = max(1, (int)($item['qty'] ?? 1));
    if ($iname === '' || $price <= 0) continue;
    $subtotal       += $price * $qty;
    $productsClean[] = ['name' => $iname, 'price' => $price, 'qty' => $qty];
}

if (empty($productsClean)) {
    http_response_code(422);
    die(json_encode(['success' => false, 'message' => 'Aucun produit valide dans le panier.'], JSON_UNESCAPED_UNICODE));
}

$total = $subtotal + $DELIVERY_FEE;

/* -- Reference unique -- */
$pdo      = getPDO();
$orderRef = _generateRef($pdo);

/* -- Token anti-fraude -- */
$invoiceToken = bin2hex(random_bytes(32));

/* -- Insertion BDD -- */
$stmt = $pdo->prepare("
    INSERT INTO orders (
        order_ref, customer_name, customer_phone, customer_address,
        products_json, subtotal, delivery, total,
        status, note, invoice_token, cancel_token, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, NOW())
");
$stmt->execute([
    $orderRef,
    $customerName,
    $customerPhone,
    $customerAddress,
    json_encode($productsClean, JSON_UNESCAPED_UNICODE),
    round($subtotal, 2),
    $DELIVERY_FEE,
    round($total, 2),
    $note,
    $invoiceToken,
    $invoiceToken,
]);
$orderId = (int)$pdo->lastInsertId();

/* -- Reponse -- */
echo json_encode([
    'success'       => true,
    'order_ref'     => $orderRef,
    'order_id'      => $orderId,
    'invoice_token' => $invoiceToken,
    'cancel_token'  => $invoiceToken,
    'subtotal'      => round($subtotal, 2),
    'delivery'      => $DELIVERY_FEE,
    'total'         => round($total, 2),
    'customer_name' => $customerName,
    'message'       => "Commande {$orderRef} enregistree avec succes.",
], JSON_UNESCAPED_UNICODE);

/* ================================================================
   FONCTIONS INTERNES
================================================================ */

function _generateRef(PDO $pdo): string
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