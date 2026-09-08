<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();

$stmt = $pdo->prepare("UPDATE products SET is_active = 1 WHERE category = 'cosmetiques'");
$stmt->execute();

$subcategories = ['peau', 'visage', 'cheveux'];
foreach ($subcategories as $sub) {
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM products WHERE category = 'cosmetiques' AND subcategory = ? AND is_active = 1");
    $stmt->execute([$sub]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "[$sub]:" . $row['cnt'] . "|";
}
echo "\n";
?>
