<?php
/**
 * TISANATURE — api/csrf.php
 * GET /api/csrf.php → { success, token }
 *
 * Le JS appelle cet endpoint au chargement de chaque page
 * et stocke le token pour l'envoyer dans X-CSRF-Token.
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../config/security.php';

apiHeaders();
startClientSession();

echo json_encode([
    'success' => true,
    'token'   => csrfToken(),
], JSON_UNESCAPED_UNICODE);