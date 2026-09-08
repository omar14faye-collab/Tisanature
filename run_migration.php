<?php
require_once __DIR__ . '/config/db.php';
$pdo = getPDO();
$sql = file_get_contents(__DIR__ . '/sql/migration_add_subcategory.sql');
try {
    $pdo->exec($sql);
    echo "Migration successful!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
unlink(__FILE__);
