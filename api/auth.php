<?php
/**
 * TISANATURE — api/auth.php
 * Authentification ADMIN (table: admins)
 *
 *  POST  ?action=login            { "email": "...", "password": "..." }
 *  POST  ?action=logout
 *  GET   ?action=check
 *  POST  ?action=change_password  { "current_password": "...", "new_password": "..." }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';

startSession();
apiHeaders();

$action = $_GET['action'] ?? 'check';

/* ══════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════ */
if ($action === 'login') {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonErr('Méthode non autorisée.', 405);
    }

    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $email    = trim(strtolower((string)($body['email']    ?? '')));
    $password = (string)($body['password'] ?? '');

    if ($email === '' || $password === '') {
        jsonErr('Email et mot de passe sont obligatoires.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonErr('Adresse e-mail invalide.', 422);
    }

    $ip           = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $maxAttempts  = 5;
    $blockSeconds = 900; // 15 min

    try {
        $pdo = getPDO();

        /* ── Protection brute-force par IP ── */
        $pdo->prepare('DELETE FROM login_attempts WHERE last_attempt < ?')
            ->execute([time() - $blockSeconds]);

        $stmt = $pdo->prepare('SELECT attempts, last_attempt FROM login_attempts WHERE ip = ? LIMIT 1');
        $stmt->execute([$ip]);
        $row  = $stmt->fetch();

        if ($row && (int)$row['attempts'] >= $maxAttempts) {
            $restant = $blockSeconds - (time() - (int)$row['last_attempt']);
            jsonErr('Trop de tentatives. Réessayez dans ' . ceil($restant / 60) . ' min.', 429);
        }

        /* ── Récupération de l'admin ── */
        $stmt = $pdo->prepare('
            SELECT id, email, name, password, role
            FROM admins
            WHERE email = ?
            LIMIT 1
        ');
        $stmt->execute([$email]);
        $admin = $stmt->fetch();

        /* ── Protection timing attack ── */
        $hash  = $admin['password'] ?? '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPD0DTP1.';
        $valid = password_verify($password, $hash);

        if (!$admin || !$valid) {
            // Incrémenter les tentatives échouées
            $pdo->prepare('
                INSERT INTO login_attempts (ip, attempts, last_attempt)
                VALUES (?, 1, ?)
                ON DUPLICATE KEY UPDATE
                    attempts     = attempts + 1,
                    last_attempt = VALUES(last_attempt)
            ')->execute([$ip, time()]);

            usleep(random_int(100000, 250000)); // délai anti-timing
            jsonErr('Email ou mot de passe incorrect.', 401);
        }

        /* ── Connexion réussie ── */
        $pdo->prepare('DELETE FROM login_attempts WHERE ip = ?')->execute([$ip]);

        session_regenerate_id(true);

        $_SESSION['admin_id']      = (int)$admin['id'];
        $_SESSION['admin_name']    = $admin['name'];
        $_SESSION['admin_email']   = $admin['email'];
        $_SESSION['admin_role']    = $admin['role'];
        $_SESSION['last_activity'] = time();

        $pdo->prepare('UPDATE admins SET last_login = NOW() WHERE id = ?')
            ->execute([$admin['id']]);

        jsonOk([
            'message' => 'Connexion réussie.',
            'name'    => $admin['name'],
            'role'    => $admin['role'],
        ]);

    } catch (PDOException $e) {
        error_log('[TISANATURE][auth/login] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */
if ($action === 'logout') {

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']
        );
    }

    session_destroy();
    jsonOk(['message' => 'Déconnecté.']);
}

/* ══════════════════════════════════════════════════════════
   CHECK SESSION
══════════════════════════════════════════════════════════ */
if ($action === 'check') {

    $isAuth = !empty($_SESSION['admin_id']);

    if ($isAuth && isset($_SESSION['last_activity'])) {
        if ((time() - (int)$_SESSION['last_activity']) > SESSION_TIMEOUT) {
            session_unset();
            if (ini_get('session.use_cookies')) {
                $p = session_get_cookie_params();
                setcookie(
                    session_name(), '', time() - 42000,
                    $p['path'], $p['domain'], $p['secure'], $p['httponly']
                );
            }
            session_destroy();
            $isAuth = false;
        } else {
            $_SESSION['last_activity'] = time();
        }
    }

    jsonOk([
        'authenticated' => $isAuth,
        'name'          => $isAuth ? ($_SESSION['admin_name']  ?? 'Admin') : null,
        'role'          => $isAuth ? ($_SESSION['admin_role']  ?? null)    : null,
        'email'         => $isAuth ? ($_SESSION['admin_email'] ?? null)    : null,
    ]);
}

/* ══════════════════════════════════════════════════════════
   CHANGE PASSWORD
══════════════════════════════════════════════════════════ */
if ($action === 'change_password') {

    requireAuthAPI();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonErr('Méthode non autorisée.', 405);
    }

    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $current = (string)($body['current_password'] ?? '');
    $new     = (string)($body['new_password']     ?? '');

    if ($current === '' || $new === '') {
        jsonErr('Les deux mots de passe sont requis.', 422);
    }
    if (mb_strlen($new, 'UTF-8') < 8) {
        jsonErr('Le nouveau mot de passe doit faire au moins 8 caractères.', 422);
    }
    if (!preg_match('/[A-Z]/', $new)) {
        jsonErr('Le nouveau mot de passe doit contenir au moins une majuscule.', 422);
    }
    if (!preg_match('/[0-9]/', $new)) {
        jsonErr('Le nouveau mot de passe doit contenir au moins un chiffre.', 422);
    }

    try {
        $pdo  = getPDO();
        $stmt = $pdo->prepare('SELECT password FROM admins WHERE id = ? LIMIT 1');
        $stmt->execute([(int)$_SESSION['admin_id']]);
        $row  = $stmt->fetch();

        if (!$row || !password_verify($current, $row['password'])) {
            jsonErr('Mot de passe actuel incorrect.', 403);
        }

        $hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare('UPDATE admins SET password = ? WHERE id = ?')
            ->execute([$hash, (int)$_SESSION['admin_id']]);

        jsonOk(['message' => 'Mot de passe modifié avec succès.']);

    } catch (PDOException $e) {
        error_log('[TISANATURE][auth/change_password] ' . $e->getMessage());
        jsonErr('Erreur serveur.', 500);
    }
}

/* ── Action inconnue ────────────────────────────────────── */
jsonErr('Action inconnue.', 404);