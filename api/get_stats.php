<?php
/**
 * ═══════════════════════════════════════════════════
 *  TISANATURE — api/get_stats.php
 *  Statistiques complètes pour le tableau de bord
 *
 *  ENDPOINT :
 *    GET /api/get_stats.php
 *
 *  RÉPONSE JSON :
 *    { success, stats, revenue_7d, revenue_30d,
 *      top_products, categories, recent, stock_alerts }
 * ═══════════════════════════════════════════════════
 */

require_once __DIR__ . '/../config/session.php';

startSession();
requireAuthAPI();
apiHeaders();

$pdo = getPDO();

/* ══════════════════════════════════════════════════
   1. STATISTIQUES GLOBALES (vue v_stats)
══════════════════════════════════════════════════ */
try {
    $stats = $pdo->query('SELECT * FROM v_stats LIMIT 1')->fetch();
} catch (PDOException $e) {
    // La vue n'existe pas encore — valeurs par défaut
    $stats = [];
}

// Fallback si la vue n'existe pas ou est incomplète
$stats = array_merge([
    'total_products'   => 0,
    'total_orders'     => 0,
    'pending_orders'   => 0,
    'delivered_orders' => 0,
    'total_revenue'    => 0.0,
    'unique_clients'   => 0,
    'today_revenue'    => 0.0,
    'today_orders'     => 0,
], $stats ?: []);

$stats['total_products']   = (int)   $stats['total_products'];
$stats['total_orders']     = (int)   $stats['total_orders'];
$stats['pending_orders']   = (int)   $stats['pending_orders'];
$stats['delivered_orders'] = (int)   $stats['delivered_orders'];
$stats['total_revenue']    = (float) $stats['total_revenue'];
$stats['unique_clients']   = (int)   $stats['unique_clients'];
$stats['today_revenue']    = (float) $stats['today_revenue'];
$stats['today_orders']     = (int)   $stats['today_orders'];

/* ══════════════════════════════════════════════════
   2. REVENUS DES 7 DERNIERS JOURS
══════════════════════════════════════════════════ */
$stmt = $pdo->query("
    SELECT
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL seq.n DAY), '%a') AS label,
        COALESCE(SUM(o.total), 0) AS revenue
    FROM (
        SELECT 0 n UNION SELECT 1 UNION SELECT 2
        UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
    ) seq
    LEFT JOIN orders o
           ON DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL seq.n DAY)
          AND o.status = 'delivered'
    GROUP BY seq.n
    ORDER BY seq.n DESC
");
$revenue7d = array_map(fn($r) => [
    'date'    => $r['label'],
    'revenue' => (float)$r['revenue'],
], $stmt->fetchAll());

/* ══════════════════════════════════════════════════
   3. REVENUS DES 30 DERNIERS JOURS
══════════════════════════════════════════════════ */
$stmt = $pdo->query("
    SELECT
        DATE(created_at)        AS d,
        COALESCE(SUM(total), 0) AS rev
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND status = 'delivered'
    GROUP BY DATE(created_at)
    ORDER BY d ASC
");
$revenue30d = array_map(fn($r) => [
    'd'   => $r['d'],
    'rev' => (float)$r['rev'],
], $stmt->fetchAll());

/* ══════════════════════════════════════════════════
   4. TOP 5 PRODUITS PAR CHIFFRE D'AFFAIRES
══════════════════════════════════════════════════ */
$ordersLivrees = $pdo->query("
    SELECT products_json FROM orders WHERE status = 'delivered'
")->fetchAll(PDO::FETCH_COLUMN);

$ventesParProduit = [];
foreach ($ordersLivrees as $jsonStr) {
    try {
        $produits = json_decode($jsonStr, true, 512, JSON_THROW_ON_ERROR);
    } catch (\JsonException $e) {
        continue;
    }
    foreach ($produits as $p) {
        $nom = trim($p['name'] ?? '');
        if ($nom === '') continue;
        if (!isset($ventesParProduit[$nom])) {
            $ventesParProduit[$nom] = ['qty' => 0, 'revenue' => 0.0];
        }
        $ventesParProduit[$nom]['qty']     += (int)($p['qty'] ?? 1);
        $ventesParProduit[$nom]['revenue'] += (float)($p['price'] ?? 0) * (int)($p['qty'] ?? 1);
    }
}

uasort($ventesParProduit, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
$topProduits = [];
foreach (array_slice($ventesParProduit, 0, 5, true) as $nom => $data) {
    $topProduits[] = [
        'name'    => $nom,
        'qty'     => $data['qty'],
        'revenue' => round($data['revenue'], 2),
    ];
}

/* ══════════════════════════════════════════════════
   5. RÉPARTITION PAR CATÉGORIE
══════════════════════════════════════════════════ */
$stmt = $pdo->query("
    SELECT
        category,
        COUNT(*)           AS nb_produits,
        SUM(price * stock) AS valeur_stock
    FROM products
    WHERE is_active = 1
    GROUP BY category
");
$categories = array_map(fn($c) => [
    'category'     => $c['category'],
    'nb_produits'  => (int)$c['nb_produits'],
    'valeur_stock' => (float)($c['valeur_stock'] ?? 0),
], $stmt->fetchAll());

/* ══════════════════════════════════════════════════
   6. DERNIÈRES 8 COMMANDES
══════════════════════════════════════════════════ */
$stmt = $pdo->query("
    SELECT
        id, order_ref,
        COALESCE(customer_name,  client_name,  '') AS customer_name,
        COALESCE(customer_phone, client_phone, '') AS customer_phone,
        total, status, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 8
");
$recentOrders = array_map(fn($o) => array_merge($o, [
    'id'    => (int)   $o['id'],
    'total' => (float) $o['total'],
]), $stmt->fetchAll());

/* ══════════════════════════════════════════════════
   7. ALERTES STOCK FAIBLE (< 5 unités)
══════════════════════════════════════════════════ */
$alertes = array_map(fn($a) => array_merge($a, [
    'id'    => (int)$a['id'],
    'stock' => (int)$a['stock'],
]), $pdo->query("
    SELECT id, name, stock, category
    FROM products
    WHERE is_active = 1 AND stock < 5
    ORDER BY stock ASC
    LIMIT 10
")->fetchAll());

/* ══════════════════════════════════════════════════
   RÉPONSE
══════════════════════════════════════════════════ */
echo json_encode([
    'success'      => true,
    'stats'        => $stats,
    'revenue_7d'   => $revenue7d,
    'revenue_30d'  => $revenue30d,
    'top_products' => $topProduits,
    'categories'   => $categories,
    'recent'       => $recentOrders,
    'stock_alerts' => $alertes,
    'generated_at' => date('Y-m-d H:i:s'),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;