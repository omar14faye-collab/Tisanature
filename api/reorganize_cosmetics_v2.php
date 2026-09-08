<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();

$subcategories = ['peau', 'visage', 'cheveux'];
$stmt = $pdo->prepare("SELECT id FROM products WHERE category = 'cosmetiques' ORDER BY id ASC");
$stmt->execute();
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo "Found " . count($ids) . " products.\n";

foreach ($ids as $index => $id) {
    if ($index < 3) $sub = 'peau';
    elseif ($index < 6) $sub = 'visage';
    elseif ($index < 9) $sub = 'cheveux';
    else $sub = 'peau'; // Should not happen with 9 products

    $upd = $pdo->prepare("UPDATE products SET subcategory = ? WHERE id = ?");
    $upd->execute([$sub, $id]);
    echo "ID $id -> $sub\n";
}

echo "Redistribution complete.";
?>
