<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();
$rows = $pdo->query("SELECT id, name, subcategory, is_active, is_verified FROM products WHERE category='cosmetiques' ORDER BY id")->fetchAll();
foreach ($rows as $r) {
    echo $r['id'].'|'.$r['name'].'|sub:'.$r['subcategory'].'|active:'.$r['is_active'].'|verified:'.$r['is_verified']."\n";
}
echo "DONE\n";
