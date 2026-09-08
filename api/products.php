<?php
/**
 * TISANATURE -- api/products.php
 *
 *  GET  ?action=public              -> produits actifs (vitrine, sans auth)
 *  GET  ?action=list                -> tous les produits (admin)
 *  GET  ?action=get&id=X            -> un produit (admin)
 *  POST ?action=add    (multipart)  -> creer un produit (admin)
 *  POST ?action=update (multipart)  -> modifier un produit (admin) — id dans FormData
 *  POST ?action=delete              -> supprimer un produit (admin) — id dans JSON body
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

$action = $_GET['action'] ?? 'list';

if (($action === 'public' || $action === 'tisanes') && $_SERVER['REQUEST_METHOD'] === 'GET') {

    apiHeaders();
    try {
        $pdo  = getPDO();
        $stmt = $pdo->query('
            SELECT id, name, description, price, stock, category, subcategory, image,
                   is_active, COALESCE(is_new, 0) AS is_new, is_verified
            FROM products
            WHERE is_active = 1 AND is_verified = 1
            ORDER BY created_at DESC
        ');
        $products = array_map(fn($p) => [
            'id'          => (int)   $p['id'],
            'name'        => $p['name'],
            'description' => $p['description'] ?? '',
            'price'       => (float) $p['price'],
            'stock'       => (int)   $p['stock'],
            'category'    => $p['category']    ?? '',
            'subcategory' => $p['subcategory'] ?? '',
            'image'       => $p['image']       ?? '',
            'is_new'      => (bool)  $p['is_new'],
            'is_active'   => (bool)  $p['is_active'],
            'is_verified' => (bool)  $p['is_verified'],
        ], $stmt->fetchAll());

        jsonOk(['products' => $products]);

    } catch (PDOException $e) {
        error_log('[TN][products/public] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* -- Toutes les autres actions necessitent une session admin -- */
startSession();
apiHeaders();
requireAuthAPI();

$pdo = getPDO();

// Auto-migration: Ensure subcategory exists
try {
    $pdo->query("SELECT subcategory FROM products LIMIT 1");
} catch (Exception $e) {
    try {
        $pdo->exec("ALTER TABLE products ADD COLUMN subcategory VARCHAR(50) DEFAULT NULL AFTER category");
        // Initial mapping
        $pdo->exec("UPDATE products SET subcategory = 'peau' WHERE category = 'cosmetiques' AND (name LIKE '%Lait%' OR name LIKE '%Huile%' OR name LIKE '%Gommage%' OR name LIKE '%Savon%')");
        $pdo->exec("UPDATE products SET subcategory = 'visage' WHERE category = 'cosmetiques' AND (name LIKE '%Masque%' OR name LIKE '%Sérum%' OR name LIKE '%Baume%')");
        $pdo->exec("UPDATE products SET subcategory = 'cheveux' WHERE category = 'cosmetiques' AND (name LIKE '%Cheveux%')");
    } catch (Exception $e2) {
        // Log or handle error if needed
    }
}

/* ================================================================
   HELPERS
================================================================ */
function handleImageUpload(?array $file, ?string $current = null): ?string
{
    if (empty($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return $current;
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonErr('Erreur lors de l\'upload de l\'image.', 422);
    }

    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    $maxSize = 3 * 1024 * 1024;
    $mime    = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);

    if (!in_array($mime, $allowed, true))  jsonErr('Format non supporte. Utilisez JPG, PNG ou WebP.', 422);
    if ($file['size'] > $maxSize)          jsonErr('Image trop lourde (max 3 Mo).', 422);

    $ext  = match($mime) { 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg' };
    $dir  = __DIR__ . '/../assets/images/products/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $filename = uniqid('prod_', true) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . $filename)) {
        jsonErr('Impossible de sauvegarder l\'image.', 500);
    }

    // Supprimer l'ancienne image avec protection path traversal
    if ($current) {
        $abs     = realpath(__DIR__ . '/../' . $current);
        $baseDir = realpath(__DIR__ . '/../assets/images/products/');
        if ($abs && $baseDir && str_starts_with($abs, $baseDir)) {
            @unlink($abs);
        }
    }

    return 'assets/images/products/' . $filename;
}

function sanitizeProduct(array $p): array
{
    return [
        'id'          => (int)   $p['id'],
        'name'        => $p['name'],
        'description' => $p['description'] ?? '',
        'price'       => (float) $p['price'],
        'stock'       => (int)   $p['stock'],
        'category'    => $p['category']    ?? '',
        'subcategory' => $p['subcategory'] ?? '',
        'image'       => $p['image']       ?? '',
        'is_active'   => (bool)  $p['is_active'],
        'is_new'      => (bool) ($p['is_new']      ?? false),
        'is_verified' => (bool) ($p['is_verified'] ?? false),
        'created_at'  => $p['created_at']  ?? '',
    ];
}

/* ================================================================
   LIST
================================================================ */
if ($action === 'list') {
    try {
        $stmt = $pdo->query('
            SELECT id, name, description, price, stock, category, subcategory, image,
                   is_active, COALESCE(is_new, 0) AS is_new, is_verified, created_at
            FROM products ORDER BY created_at DESC
        ');
        jsonOk(['products' => array_map('sanitizeProduct', $stmt->fetchAll())]);
    } catch (PDOException $e) {
        error_log('[TN][products/list] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ================================================================
   GET
================================================================ */
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) jsonErr('ID produit invalide.', 422);
    try {
        $stmt = $pdo->prepare('
            SELECT id, name, description, price, stock, category, subcategory, image,
                   is_active, COALESCE(is_new, 0) AS is_new, is_verified, created_at
            FROM products WHERE id = ? LIMIT 1
        ');
        $stmt->execute([$id]);
        $product = $stmt->fetch();
        if (!$product) jsonErr('Produit introuvable.', 404);
        jsonOk(['product' => sanitizeProduct($product)]);
    } catch (PDOException $e) {
        error_log('[TN][products/get] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ================================================================
   ADD
================================================================ */
if ($action === 'add') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Methode non autorisee.', 405);

    $name        = trim((string)($_POST['name']        ?? ''));
    $description = trim((string)($_POST['description'] ?? ''));
    $price       = (string)($_POST['price']            ?? '');
    $stock       = (string)($_POST['stock']            ?? '0');
    $category    = trim((string)($_POST['category']    ?? 'tisanes'));
    $subcategory = trim((string)($_POST['subcategory'] ?? ''));
    $is_active   = (int)(bool)($_POST['is_active']     ?? 1);
    $is_new      = (int)(bool)($_POST['is_new']        ?? 0);
    $is_verified = (int)(bool)($_POST['is_verified']   ?? 1);

    $errors = [];
    if ($name === '')                               $errors['name']  = 'Le nom est obligatoire.';
    if (!is_numeric($price) || (float)$price < 0)  $errors['price'] = 'Prix invalide.';
    if (!is_numeric($stock) || (int)$stock   < 0)  $errors['stock'] = 'Stock invalide.';
    if ($errors) jsonErr('Donnees invalides.', 422, $errors);

    try {
        $image = handleImageUpload($_FILES['image'] ?? null);
        $slug = 'p-' . uniqid();
        $pdo->prepare('
            INSERT INTO products
                (name, slug, description, price, stock, category, subcategory, image, is_active, is_new, is_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ')->execute([
            $name, $slug, $description, (float)$price, (int)$stock,
            $category, $subcategory, $image, $is_active, $is_new, $is_verified
        ]);
        jsonOk(['message' => 'Produit cree.', 'id' => (int)$pdo->lastInsertId()]);
    } catch (PDOException $e) {
        error_log('[TN][products/add] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ================================================================
   UPDATE
   admin.js envoie l'id dans le FormData (pas dans l'URL)
================================================================ */
if ($action === 'update') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Methode non autorisee.', 405);

    // Lire l'id depuis GET ou FormData
    $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
    if ($id <= 0) jsonErr('ID produit invalide.', 422);

    $name        = trim((string)($_POST['name']        ?? ''));
    $description = trim((string)($_POST['description'] ?? ''));
    $price       = (string)($_POST['price']            ?? '');
    $stock       = (string)($_POST['stock']            ?? '0');
    $category    = trim((string)($_POST['category']    ?? 'tisanes'));
    $subcategory = trim((string)($_POST['subcategory'] ?? ''));
    $is_active   = (int)(bool)($_POST['is_active']     ?? 1);
    $is_new      = (int)(bool)($_POST['is_new']        ?? 0);
    $is_verified = (int)(bool)($_POST['is_verified']   ?? 1);

    $errors = [];
    if ($name === '')                               $errors['name']  = 'Le nom est obligatoire.';
    if (!is_numeric($price) || (float)$price < 0)  $errors['price'] = 'Prix invalide.';
    if (!is_numeric($stock) || (int)$stock   < 0)  $errors['stock'] = 'Stock invalide.';
    if ($errors) jsonErr('Donnees invalides.', 422, $errors);

    try {
        $stmt = $pdo->prepare('SELECT image FROM products WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonErr('Produit introuvable.', 404);

        $image = handleImageUpload($_FILES['image'] ?? null, $row['image']);

        $pdo->prepare('
            UPDATE products
            SET name=?, description=?, price=?, stock=?, category=?, subcategory=?,
                image=?, is_active=?, is_new=?, is_verified=?, updated_at=NOW()
            WHERE id=?
        ')->execute([
            $name, $description, (float)$price, (int)$stock,
            $category, $subcategory, $image, $is_active, $is_new, $is_verified, $id
        ]);

        jsonOk(['message' => 'Produit mis a jour.']);
    } catch (PDOException $e) {
        error_log('[TN][products/update] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ================================================================
   DELETE
   admin.js envoie l'id dans le body JSON (pas dans l'URL)
================================================================ */
if ($action === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Methode non autorisee.', 405);

    // Lire l'id depuis GET, puis body JSON si absent
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $id   = (int)($body['id'] ?? 0);
    }
    if ($id <= 0) jsonErr('ID produit invalide.', 422);

    try {
        $stmt = $pdo->prepare('SELECT image FROM products WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonErr('Produit introuvable.', 404);

        if ($row['image']) {
            $abs     = realpath(__DIR__ . '/../' . $row['image']);
            $baseDir = realpath(__DIR__ . '/../assets/images/products/');
            if ($abs && $baseDir && str_starts_with($abs, $baseDir)) {
                @unlink($abs);
            }
        }

        $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
        jsonOk(['message' => 'Produit supprime.']);

    } catch (PDOException $e) {
        error_log('[TN][products/delete] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

jsonErr('Action inconnue.', 404);