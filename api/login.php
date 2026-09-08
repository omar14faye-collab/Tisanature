<?php
/**
 * TISANATURE — api/login.php  (sécurisé)
 * POST /api/login.php
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../config/security.php';

apiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Méthode non autorisée.', 405);
}

/* ── Rate limiting : 10 tentatives / 15 min par IP ── */
rateLimit('login', 10, 900);

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = sanitizeEmail($body['email']    ?? '');
$password = (string)($body['password']      ?? '');
$remember = !empty($body['remember']);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonErr('Adresse e-mail invalide.', 422);
}
if (strlen($password) < 6) {
    jsonErr('Veuillez saisir votre mot de passe.', 422);
}

try {
    $pdo  = getPDO();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    /* Anti-timing attack */
    $dummy = '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPD0DTP1.';
    if (!$user) {
        password_verify($password, $dummy);
        jsonErr('Identifiants incorrects.', 401);
    }

    $hash = $user['password_hash'] ?? $user['password'] ?? '';
    if ($hash === '' || !password_verify($password, $hash)) {
        jsonErr('Identifiants incorrects.', 401);
    }

    if (array_key_exists('is_active', $user) && !(int)$user['is_active']) {
        jsonErr('Ce compte est désactivé. Contactez le support.', 403);
    }

    /* ── Login OK : réinitialiser le rate limit ── */
    rateLimitReset('login');

    startClientSession();
    session_regenerate_id(true);

    $_SESSION['user_id']       = (int)$user['id'];
    $_SESSION['user_name']     = (string)($user['name']  ?? '');
    $_SESSION['user_email']    = (string)($user['email'] ?? '');
    $_SESSION['last_activity'] = time();

    /* ── Remember me ── */
    if ($remember) {
        try {
            $token   = bin2hex(random_bytes(32));
            $expires = time() + 30 * 24 * 3600;
            $pdo->prepare('UPDATE users SET remember_token = ? WHERE id = ?')
                ->execute([hash('sha256', $token), (int)$user['id']]);
            setcookie('remember_token', $token, [
                'expires'  => $expires,
                'path'     => '/',
                'httponly' => true,
                'samesite' => 'Lax',
                'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            ]);
        } catch (PDOException $e) {
            error_log('[TN][login/remember] ' . $e->getMessage());
        }
    }

    jsonOk([
        'message'  => 'Connexion réussie.',
        'name'     => $user['name'] ?? '',
        'redirect' => 'account.html',
    ]);

} catch (PDOException $e) {
    error_log('[TN][login] ' . $e->getMessage());
    jsonErr('Erreur serveur. Réessayez.', 500);
}