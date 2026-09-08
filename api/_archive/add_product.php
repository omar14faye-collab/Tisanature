<?php
/**
 * ═══════════════════════════════════════════════════
 *  TISANATURE — api/add_product.php
 *  Ajouter un nouveau produit au catalogue
 *
 *  NOTE : Cet endpoint est conservé pour compatibilité.
 *         Préférez products.php?action=add (même logique intégrée).
 *
 *  ENDPOINT :
 *    POST /api/add_product.php
 *    Content-Type: multipart/form-data
 *
 *  CHAMPS POST :
 *    name        string   Nom du produit          (obligatoire)
 *    price       float    Prix en FCFA            (obligatoire si non-service)
 *    category    string   tisanes|cosmetiques|services
 *    description string   Description complète
 *    stock       int      Quantité en stock       (≥ 0)
 *    is_active   int      1=actif, 0=inactif      (défaut: 1)
 *    is_new      int      1=badge Nouveauté        (défaut: 0)
 *    image       file     Image produit (JPG/PNG/WEBP, max 3 Mo)
 *
 *  RÉPONSE JSON :
 *    { success, message, product: {...} }
 * ═══════════════════════════════════════════════════
 */

require_once __DIR__ . '/../config/session.php';

startSession();
apiHeaders();
requireAuthAPI();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée. Utilisez POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ── Lecture et validation ── */
$name        = trim($_POST['name']        ?? '');
$price       = (float)($_POST['price']    ?? 0);
$category    = trim($_POST['category']    ?? 'tisanes');
$description = trim($_POST['description'] ?? '');
$stock       = max(0, (int)($_POST['stock'] ?? 0));
$is_active   = isset($_POST['is_active'])   ? (int)$_POST['is_active']   : 1;
$is_new      = isset($_POST['is_new'])      ? (int)$_POST['is_new']      : 0;
$is_verified = isset($_POST['is_verified']) ? (int)$_POST['is_verified'] : 1;

$errors = [];
if ($name === '')                                                          $errors[] = 'Le nom du produit est obligatoire.';
if (mb_strlen($name, 'UTF-8') > 200)                                       $errors[] = 'Nom trop long (max 200 caractères).';
if (mb_strlen($description, 'UTF-8') > 5000)                               $errors[] = 'Description trop longue (max 5000 caractères).';
if (!in_array($category, ['tisanes', 'cosmetiques', 'services'], true))    $errors[] = 'Catégorie invalide.';
if ($category !== 'services' && $price <= 0)                               $errors[] = 'Le prix doit être supérieur à 0.';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => implode(' | ', $errors)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($category === 'services') $price = 0;

/* ── Slug unique ── */
$pdo  = getPDO();
$slug = _apSlug($name);
$slug = _apUniqueSlug($pdo, $slug);

/* ── Upload image ── */
$imagePath  = null;
$imageTemp  = null;

if (!empty($_FILES['image']['name'])) {
    $fichier = $_FILES['image'];

    if ($fichier['error'] !== UPLOAD_ERR_OK) {
        $msgs = [
            UPLOAD_ERR_INI_SIZE  => 'Fichier trop volumineux (limite serveur).',
            UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux (limite formulaire).',
            UPLOAD_ERR_PARTIAL   => 'Upload partiel, réessayez.',
        ];
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => $msgs[$fichier['error']] ?? 'Erreur upload.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($fichier['size'] > 3 * 1024 * 1024) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Image trop volumineuse (max 3 Mo).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $finfo   = new finfo(FILEINFO_MIME_TYPE);
    $mime    = $finfo->file($fichier['tmp_name']);
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    if (!isset($allowed[$mime])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Format non supporté (JPG, PNG, WEBP).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ext     = $allowed[$mime];
    $nom     = $slug . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
    $dossier = __DIR__ . '/../uploads/products/';

    if (!is_dir($dossier) && !mkdir($dossier, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Impossible de créer le dossier upload.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $chemin = $dossier . $nom;
    if (!move_uploaded_file($fichier['tmp_name'], $chemin)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Impossible de sauvegarder l\'image.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $imagePath = 'uploads/products/' . $nom;
    $imageTemp = $chemin;
}

/* ── Insertion avec transaction (rollback image si INSERT échoue) ── */
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("
        INSERT INTO products (name, slug, price, description, category, image, stock, is_new, is_active, is_verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$name, $slug, $price, $description, $category, $imagePath, $stock, $is_new, $is_active, $is_verified]);
    $newId = (int)$pdo->lastInsertId();
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    if ($imageTemp && file_exists($imageTemp)) @unlink($imageTemp);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur base de données lors de l\'ajout.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$select = $pdo->prepare('SELECT * FROM products WHERE id = ?');
$select->execute([$newId]);
$p = $select->fetch();
$p = array_merge($p, [
    'id'        => (int)   $p['id'],
    'price'     => (float) $p['price'],
    'stock'     => (int)   $p['stock'],
    'is_new'    => (bool)  $p['is_new'],
    'is_active' => (bool)  $p['is_active'],
]);

echo json_encode([
    'success' => true,
    'message' => 'Produit "' . $name . '" ajouté avec succès.',
    'product' => $p,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;

/* ── Helpers locaux ── */
function _apSlug(string $str): string
{
    $acc = ['à'=>'a','â'=>'a','é'=>'e','è'=>'e','ê'=>'e','î'=>'i','ô'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c'];
    $str = mb_strtolower($str, 'UTF-8');
    $str = str_replace(array_keys($acc), array_values($acc), $str);
    $str = preg_replace('/[^a-z0-9\s\-]/', '', $str);
    $str = preg_replace('/[\s\-]+/', '-', trim($str));
    return $str ?: 'produit';
}

function _apUniqueSlug(PDO $pdo, string $base): string
{
    $attempt = 0;
    do {
        $candidate = $attempt === 0 ? $base : $base . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
        $check = $pdo->prepare('SELECT id FROM products WHERE slug = ? LIMIT 1');
        $check->execute([$candidate]);
        $free = !$check->fetch();
        $attempt++;
    } while (!$free && $attempt < 10);
    return $candidate;
}