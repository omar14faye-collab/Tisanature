<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();

$subcategories = ['peau', 'visage', 'cheveux'];
foreach ($subcategories as $sub) {
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM products WHERE category = 'cosmetiques' AND subcategory = ?");
    $stmt->execute([$sub]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Subcategory [$sub]: " . $row['cnt'] . " products\n";
}
?>
