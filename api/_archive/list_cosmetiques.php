<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();

$stmt = $pdo->prepare("SELECT * FROM products WHERE category = 'cosmetiques'");
$stmt->execute();
$all = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Total Cosmetiques: " . count($all) . "\n";
foreach ($all as $p) {
    echo "ID: {$p['id']}, Name: {$p['name']}, Sub: {$p['subcategory']}\n";
}
?>
