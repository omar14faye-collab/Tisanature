<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config/db.php';
$pdo = getPDO();
$stmt = $pdo->query("SELECT id, name, category, subcategory, is_active, is_verified FROM products WHERE category='cosmetiques'");
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
