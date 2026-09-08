<?php
/**
 * TISANATURE — api/update_profile.php  (v2 — schema corrigé)
 * POST /api/update_profile.php
 * { name, email, phone, address, city, zone, old_password?, new_password? }
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
$email       = trim(strtolower((string)($body['email'] ?? '')));
$phone       = trim((string)($body['phone']        ?? ''));
$address     = trim((string)($body['address']      ?? ''));
$city        = trim((string)($body['city']         ?? 'Dakar'));
$zone        = trim((string)($body['zone']         ?? ''));
$oldPassword = (string)($body['old_password']      ?? '');
$newPassword = (string)($body['new_password']      ?? '');

/* ── Validation ── */
if ($name === '') jsonErr('Le nom est obligatoire.', 422);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('E-mail invalide.', 422);

/* ── Récupérer le compte ── */
try {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$uid]);
    $current = $stmt->fetch();
    if (!$current) { session_destroy(); jsonErr('Compte introuvable.', 404); }
} catch (PDOException $e) {
    error_log('[TN][update_profile/fetch] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}

/* ── Unicité email / téléphone ── */
$finalEmail = $email ?: $current['email'];
if ($email !== '' && $email !== $current['email']) {
    $s = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
    $s->execute([$email, $uid]);
    if ($s->fetch()) jsonErr('Cette adresse e-mail est déjà utilisée.', 409);
}
if ($phone !== '' && $phone !== $current['phone']) {
    $s = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1');
    $s->execute([$phone, $uid]);
    if ($s->fetch()) jsonErr('Ce numéro de téléphone est déjà utilisé.', 409);
}

/* ── Changement de mot de passe (optionnel) ── */
$newHash = null;
if ($newPassword !== '') {
    if ($oldPassword === '') jsonErr('Le mot de passe actuel est requis.', 422);
    $storedHash = $current['password_hash'] ?? $current['password'] ?? '';
    if (!password_verify($oldPassword, $storedHash)) jsonErr('Mot de passe actuel incorrect.', 403);
    if (mb_strlen($newPassword, 'UTF-8') < 8) jsonErr('Minimum 8 caractères requis.', 422);
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
}

/* ── Mise à jour — colonnes city/zone via COALESCE si migration pas encore lancée ── */
try {
    /* Détecter les colonnes disponibles */
    $cols  = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(\PDO::FETCH_COLUMN);
    $hasCity = in_array('city', $cols, true);
    $hasZone = in_array('zone', $cols, true);

    $set    = 'name=?, email=?, phone=?, address=?';
    $values = [$name, $finalEmail, $phone, $address ?: null];

    if ($hasCity) { $set .= ', city=?';         $values[] = $city; }
    if ($hasZone) { $set .= ', zone=?';         $values[] = $zone; }
    if ($newHash) { $set .= ', password_hash=?'; $values[] = $newHash; }

    $set     .= ', updated_at=NOW()';
    $values[] = $uid;

    $pdo->prepare("UPDATE users SET {$set} WHERE id=?")->execute($values);

    /* Mettre à jour la session */
    $_SESSION['user_name']  = $name;
    $_SESSION['user_email'] = $finalEmail;

    jsonOk(['message' => 'Profil mis à jour avec succès.']);

} catch (PDOException $e) {
    error_log('[TN][update_profile/update] ' . $e->getMessage());
    jsonErr('Erreur serveur.', 500);
}