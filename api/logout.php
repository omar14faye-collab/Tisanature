<?php
/**
 * TISANATURE — api/logout.php
 * POST /api/logout.php — détruit la session CLIENT (tn_client_sess)
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

apiHeaders();
startClientSession();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}

session_destroy();

/* Supprimer le cookie remember_token */
if (isset($_COOKIE['remember_token'])) {
    setcookie('remember_token', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
    ]);
}

jsonOk(['message' => 'Déconnecté avec succès.']);