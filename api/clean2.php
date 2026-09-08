<?php
require_once __DIR__ . '/../config/session.php';
try {
    $pdo = getPDO();
    $stmt = $pdo->query("SELECT id, name, category FROM products WHERE category = 'tisanes'");
    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if(count($res) > 0) {
        foreach($res as $r) {
            echo "[".$r['id']."] ".$r['name']."\n";
            $pdo->exec("DELETE FROM products WHERE id = " . $r['id']);
        }
    } else {
        echo "Aucune tisane en base.";
    }
} catch (Exception $e) {
    echo "ERROR - " . $e->getMessage();
}
