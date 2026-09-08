```php
<?php
/**
 * TISANATURE -- api/register.php
 * POST /api/register.php
 * Corps JSON : { name, email, phone, password, address?, newsletter }
 * Reponse    : { success, message, name, redirect }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Methode non autorisee.', 405);
}

/* -- 1. Lecture du corps JSON -- */
$body       = json_decode(file_get_contents('php://input'), true) ?? [];
$name       = mb_substr(trim((string)($body['name']       ?? '')), 0, 120);
$email      = mb_substr(trim((string)($body['email']      ?? '')), 0, 180);
$phone      = mb_substr(trim((string)($body['phone']      ?? '')), 0,  30);
$password   = (string)($body['password']                           ?? '');
$address    = mb_substr(trim((string)($body['address']    ?? '')), 0, 500);
$newsletter = !empty($body['newsletter']) ? 1 : 0;

/* -- 2. Validation serveur -- */
$errors = [];
if (mb_strlen($name) < 2)                         $errors[] = 'Le nom doit contenir au moins 2 caracteres.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    $errors[] = 'Adresse e-mail invalide.';
if (strlen(preg_replace('/\D/', '', $phone)) < 8)  $errors[] = 'Numero de telephone invalide.';
if (strlen($password) < 8)                         $errors[] = 'Le mot de passe doit contenir au moins 8 caracteres.';

if (!empty($errors)) {
    jsonErr(implode(' ', $errors), 422);
}

/* -- 3. Verifier doublon e-mail -- */
$pdo  = getPDO();
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonErr('Cette adresse e-mail est deja utilisee.', 409);
}

/* -- 4. Hacher le mot de passe -- */
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
if ($hash === false) {
    jsonErr('Erreur interne. Veuillez reessayer.', 500);
}

/* -- 5. Insertion en base -- */
try {
    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, phone, password_hash, address, newsletter, is_active)
         VALUES (:name, :email, :phone, :hash, :address, :newsletter, 1)'
    );
    $insert->execute([
        ':name'       => $name,
        ':email'      => $email,
        ':phone'      => $phone,
        ':hash'       => $hash,
        ':address'    => $address !== '' ? $address : null,
        ':newsletter' => $newsletter,
    ]);
    $newId = (int) $pdo->lastInsertId();
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        jsonErr('Cette adresse e-mail est deja utilisee.', 409);
    }
    error_log('[TISANATURE][register] ' . $e->getMessage());
    jsonErr('Erreur lors de la creation du compte. Veuillez reessayer.', 500);
}

/* -- 6. Session CLIENT (correction : startClientSession, pas startSession) -- */
startClientSession();
session_regenerate_id(true);

$_SESSION['user_id']       = $newId;
$_SESSION['user_name']     = $name;
$_SESSION['user_email']    = $email;
$_SESSION['last_activity'] = time();

/* -- 7. Reponse succes -- */
jsonOk([
    'message'  => 'Compte cree avec succes. Bienvenue chez TISANATURE !',
    'name'     => $name,
    'redirect' => 'account.html',
]);
```


```php
<?php
/**
 * TISANATURE — api/update_profile.php
 * Mise à jour du profil client connecté
 *
 *  POST /api/update_profile.php
 *  { name, email, phone, address, city, zone, old_password?, new_password? }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

startClientSession();
apiHeaders();
requireClientAuthAPI();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Méthode non autorisée.', 405);
}

$pdo  = getPDO();
$uid  = (int)$_SESSION['user_id'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$name        = trim((string)($body['name']         ?? ''));
$email       = trim(strtolower((string)($body['email']    ?? '')));
$phone       = trim((string)($body['phone']        ?? ''));
$address     = trim((string)($body['address']      ?? ''));
$oldPassword = (string)($body['old_password'] ?? '');
$newPassword = (string)($body['new_password'] ?? '');

/* ── Validation ── */
$errors = [];
if ($name === '')                                  $errors['name']  = 'Le nom est obligatoire.';
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'E-mail invalide.';

if (!empty($errors)) {
    jsonErr('Données invalides.', 422, $errors);
}

/* ── Récupérer le compte actuel ── */
try {
    $stmt = $pdo->prepare('SELECT id, email, phone, password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $current = $stmt->fetch();
    if (!$current) {
        session_destroy();
        jsonErr('Compte introuvable.', 404);
    }
} catch (PDOException $e) {
    error_log('[TN][update_profile/fetch] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}

/* ── Vérifier unicité email/téléphone ── */
if ($email !== '' && $email !== $current['email']) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
    $stmt->execute([$email, $uid]);
    if ($stmt->fetch()) jsonErr('Cette adresse e-mail est déjà utilisée.', 409);
}
if ($phone !== '' && $phone !== $current['phone']) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1');
    $stmt->execute([$phone, $uid]);
    if ($stmt->fetch()) jsonErr('Ce numéro de téléphone est déjà utilisé.', 409);
}

/* ── Changement de mot de passe (optionnel) ── */
$newHash = null;
if ($newPassword !== '') {
    if ($oldPassword === '') {
        jsonErr('Le mot de passe actuel est requis pour le modifier.', 422);
    }
    if (!password_verify($oldPassword, $current['password_hash'])) {
        jsonErr('Mot de passe actuel incorrect.', 403);
    }
    if (mb_strlen($newPassword, 'UTF-8') < 8) {
        jsonErr('Le nouveau mot de passe doit faire au moins 8 caractères.', 422);
    }
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
}

/* ── Mise à jour ── */
try {
    if ($newHash !== null) {
        $pdo->prepare('
            UPDATE users
            SET name=?, email=?, phone=?, address=?, password_hash=?, updated_at=NOW()
            WHERE id=?
        ')->execute([$name, $email ?: $current['email'], $phone, $address, $newHash, $uid]);
    } else {
        $pdo->prepare('
            UPDATE users
            SET name=?, email=?, phone=?, address=?, updated_at=NOW()
            WHERE id=?
        ')->execute([$name, $email ?: $current['email'], $phone, $address, $uid]);
    }

    // Mettre à jour la session
    $_SESSION['user_name']  = $name;
    $_SESSION['user_email'] = $email ?: $current['email'];

    jsonOk(['message' => 'Profil mis à jour avec succès.']);

} catch (PDOException $e) {
    error_log('[TN][update_profile/update] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}
```


```php
<?php
/**
 * TISANATURE -- api/preference.php
 * Sauvegarde des preferences client
 *
 *  POST /api/preference.php
 *  Corps JSON : { confirm, tracking, newsletter, tips, analytics }
 *
 *  Les preferences sont stockees dans users.preferences (colonne JSON TEXT).
 *  La colonne newsletter est egalement mise a jour pour compatibilite.
 *
 *  Schema requis :
 *    ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT NULL;
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();
startClientSession();
requireClientAuthAPI();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Methode non autorisee.', 405);
}

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$allowed = ['confirm', 'tracking', 'newsletter', 'tips', 'analytics'];

$prefs = [];
foreach ($allowed as $key) {
    $prefs[$key] = isset($body[$key]) ? (bool) $body[$key] : false;
}

$newsletter = $prefs['newsletter'] ? 1 : 0;
$userId     = (int) $_SESSION['user_id'];

try {
    $pdo = getPDO();

    /* Mise a jour simultanee de preferences (JSON) et newsletter (colonne dedie) */
    $stmt = $pdo->prepare('
        UPDATE users
        SET preferences = ?,
            newsletter  = ?,
            updated_at  = NOW()
        WHERE id = ?
    ');
    $stmt->execute([
        json_encode($prefs, JSON_UNESCAPED_UNICODE),
        $newsletter,
        $userId,
    ]);

    jsonOk(['message' => 'Preferences enregistrees.']);

} catch (PDOException $e) {
    error_log('[TN][preference] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}
```