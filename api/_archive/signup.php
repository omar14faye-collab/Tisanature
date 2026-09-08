<?php
/**
 * TISANATURE — api/signup.php  (corrigé — sans colonne role)
 * POST /api/signup.php
 * Corps JSON : { name, email, phone, password, password_confirm, address, newsletter }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Méthode non autorisée.', 405);
}

$body            = json_decode(file_get_contents('php://input'), true) ?? [];
$name            = trim((string)($body['name']             ?? ''));
$email           = trim(strtolower((string)($body['email'] ?? '')));
$phone           = trim((string)($body['phone']            ?? ''));
$password        = (string)($body['password']              ?? '');
$passwordConfirm = (string)($body['password_confirm']      ?? '');
$address         = trim((string)($body['address']          ?? ''));
$newsletter      = !empty($body['newsletter']) ? 1 : 0;

/* ── Validation ── */
$errors = [];

if ($name === '' || strlen($name) < 2)
    $errors['name'] = 'Le nom complet est requis (min. 2 caractères).';
elseif (strlen($name) > 100)
    $errors['name'] = 'Le nom ne doit pas dépasser 100 caractères.';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL))
    $errors['email'] = 'Adresse e-mail invalide.';

if ($phone === '' || !preg_match('/^\+?[\d\s\-\(\)]{7,20}$/', $phone))
    $errors['phone'] = 'Numéro de téléphone invalide.';

if (strlen($password) < 8)
    $errors['password'] = 'Le mot de passe doit contenir au moins 8 caractères.';
elseif (!preg_match('/[A-Z]/', $password))
    $errors['password'] = 'Le mot de passe doit contenir au moins une majuscule.';
elseif (!preg_match('/[0-9]/', $password))
    $errors['password'] = 'Le mot de passe doit contenir au moins un chiffre.';

if ($password !== $passwordConfirm)
    $errors['password_confirm'] = 'Les mots de passe ne correspondent pas.';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Veuillez corriger les erreurs.', 'errors' => $errors], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getPDO();

/* ── Unicité e-mail ── */
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Cette adresse e-mail est déjà utilisée.', 'errors' => ['email' => 'Déjà utilisée.']], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ── Unicité téléphone ── */
$stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Ce numéro de téléphone est déjà utilisé.', 'errors' => ['phone' => 'Déjà utilisé.']], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ── Insertion — SANS colonne role (n'existe pas dans users) ── */
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

try {
    $pdo->prepare('
        INSERT INTO users (name, email, phone, password_hash, address, newsletter)
        VALUES (?, ?, ?, ?, ?, ?)
    ')->execute([
        $name,
        $email,
        $phone,
        $hash,
        $address !== '' ? $address : null,
        $newsletter,
    ]);
    $newUserId = (int)$pdo->lastInsertId();

} catch (\PDOException $e) {
    if ($e->getCode() === '23000') {
        jsonErr('Adresse e-mail déjà utilisée.', 409);
    }
    error_log('[TN][signup] ' . $e->getMessage());
    jsonErr('Erreur lors de la création du compte. Veuillez réessayer.', 500);
}

/* ── Session CLIENT ── */
startClientSession();
session_regenerate_id(true);

$_SESSION['user_id']       = $newUserId;
$_SESSION['user_name']     = $name;
$_SESSION['user_email']    = $email;
$_SESSION['last_activity'] = time();

jsonOk([
    'message'  => 'Compte créé avec succès. Bienvenue chez TISANATURE !',
    'name'     => $name,
    'redirect' => 'account.html',
]);