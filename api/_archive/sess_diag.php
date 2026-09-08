<?php
require_once __DIR__ . '/../config/session.php';

// Try client session
startClientSession();

header('Content-Type: application/json');
echo json_encode([
    'session_name'    => session_name(),
    'session_id'      => session_id(),
    'session_status'  => session_status(),
    'user_id'         => $_SESSION['user_id'] ?? null,
    'user_name'       => $_SESSION['user_name'] ?? null,
    'last_activity'   => $_SESSION['last_activity'] ?? null,
    'session_data'    => $_SESSION,
    'cookies'         => $_COOKIE,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
