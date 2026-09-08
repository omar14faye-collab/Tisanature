<?php
/**
 * TISANATURE — diagnostic.php
 * Ouvrir dans le navigateur : http://localhost/projet3/diagnostic.php
 * SUPPRIMER ce fichier après usage !
 */
require_once __DIR__ . '/config/db.php';

header('Content-Type: text/html; charset=utf-8');
echo '<pre style="font-family:monospace;padding:2rem;background:#f5f5f5">';
echo "=== TISANATURE DIAGNOSTIC ===\n\n";

try {
    $pdo = getPDO();
    echo "✅ Connexion DB OK\n\n";

    /* Version MySQL */
    $v = $pdo->query("SELECT VERSION() as v")->fetch();
    echo "MySQL version : " . $v['v'] . "\n\n";

    /* Colonnes orders */
    echo "--- Colonnes TABLE orders ---\n";
    $cols = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll();
    foreach ($cols as $c) {
        echo "  {$c['Field']} ({$c['Type']}) " . ($c['Null'] === 'YES' ? 'NULL' : 'NOT NULL') . "\n";
    }

    /* Colonnes users */
    echo "\n--- Colonnes TABLE users ---\n";
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll();
    foreach ($cols as $c) {
        echo "  {$c['Field']} ({$c['Type']}) " . ($c['Null'] === 'YES' ? 'NULL' : 'NOT NULL') . "\n";
    }

    /* Nb commandes */
    $nb = $pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn();
    echo "\n--- Commandes en base : {$nb} ---\n";

    if ($nb > 0) {
        $sample = $pdo->query("SELECT id, order_ref, customer_phone, status FROM orders LIMIT 3")->fetchAll();
        foreach ($sample as $r) {
            echo "  #{$r['id']} {$r['order_ref']} | {$r['customer_phone']} | status={$r['status']}\n";
        }
    }

    /* Nb users */
    $nu = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    echo "\n--- Utilisateurs en base : {$nu} ---\n";

    if ($nu > 0) {
        $users = $pdo->query("SELECT id, name, email, phone FROM users LIMIT 3")->fetchAll();
        foreach ($users as $u) {
            echo "  #{$u['id']} {$u['name']} | {$u['email']} | phone={$u['phone']}\n";
        }
    }

    /* Colonnes manquantes */
    $orderCols = array_column($pdo->query("SHOW COLUMNS FROM orders")->fetchAll(), 'Field');
    $userCols  = array_column($pdo->query("SHOW COLUMNS FROM users")->fetchAll(),  'Field');

    $missingOrders = array_diff(['subtotal','cancel_token','delivery_fee'], $orderCols);
    $missingUsers  = array_diff(['is_active','preferences','city','zone'],  $userCols);

    echo "\n--- Colonnes manquantes ---\n";
    if (empty($missingOrders) && empty($missingUsers)) {
        echo "  ✅ Aucune colonne manquante — migration OK\n";
    } else {
        foreach ($missingOrders as $c) echo "  ❌ orders.{$c} MANQUANTE\n";
        foreach ($missingUsers  as $c) echo "  ❌ users.{$c}  MANQUANTE\n";
        echo "\n  → Lance migration.sql dans phpMyAdmin !\n";
    }

} catch (Exception $e) {
    echo "❌ ERREUR : " . $e->getMessage() . "\n";
}

echo "\n⚠️  SUPPRIME CE FICHIER APRÈS USAGE\n";
echo '</pre>';