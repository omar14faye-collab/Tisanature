<?php
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();

// Fix subcategories to be name-coherent
// Peau: Lait Corps, Huile Corps, Gommage Corps
$pdo->exec("UPDATE products SET subcategory='peau' WHERE id IN (5,8,11)");
// Visage: Masque Visage, Sérum Anti-âge, Savon Douceur  
$pdo->exec("UPDATE products SET subcategory='visage' WHERE id IN (6,9,10)");
// Cheveux: Crème Cheveux, Baume Lèvres, essai
$pdo->exec("UPDATE products SET subcategory='cheveux' WHERE id IN (7,12,79)");

$rows = $pdo->query("SELECT id,name,subcategory FROM products WHERE category='cosmetiques' ORDER BY subcategory,id")->fetchAll();
foreach ($rows as $r) {
    echo "[{$r['subcategory']}] ID:{$r['id']} - {$r['name']}\n";
}
echo "DONE\n";
