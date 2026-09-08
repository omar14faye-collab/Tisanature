# 🌿 TISANATURE

Site e-commerce dédié à la vente de tisanes et cosmétiques naturels, avec espace client et espace administrateur complet.

🔗 **GitHub** : https://github.com/omar14faye-collab/Tisanature
👤 **Auteur** : Oumar Bounkhatab Faye — [github.com/omar14faye-collab](https://github.com/omar14faye-collab)

---

## Aperçu

visualisez le site sur Tisanature/screenshots

---

## ✨ Fonctionnalités

- Catalogue de produits (tisanes, cosmétiques, services) avec catégories et sous-catégories
- Système de commande avec suivi de statut (nouvelle, confirmée, expédiée, livrée, annulée)
- Espace client (compte, historique de commandes, préférences)
- Chat en direct entre clients et administrateur
- Espace administrateur complet :
  - Gestion des produits (ajout, modification, stock)
  - Gestion des commandes et de leur statut
  - Modération des messages/avis
  - Page de diagnostic du site (état général, statistiques, alertes)
- Pages légales (mentions légales, confidentialité, conditions d'utilisation)
- Système d'authentification sécurisé (mot de passe oublié, protection anti-bruteforce)

---

## 🛠️ Technologies utilisées

- **Backend** : PHP
- **Frontend** : HTML, CSS, JavaScript
- **Base de données** : MySQL / MariaDB
- **Environnement de développement local** : XAMPP

---

## 📁 Structure du projet

```
projet3/
├── administrateur/     → Espace admin (gestion produits, commandes, diagnostic)
├── API/                 → Endpoints PHP (auth, produits, commandes, messages...)
├── actifs/               → CSS, JS, images
├── configuration/       → Connexion base de données, sécurité, sessions (non versionné)
├── images/              → Images statiques du site
├── SQL/                 → Scripts de structure et migrations de la base de données
├── téléchargements/     → Fichiers uploadés par les utilisateurs (produits)
├── index.html            → Page d'accueil
├── connexion.html        → Connexion utilisateur
├── inscription.html      → Inscription utilisateur
├── compte.html           → Espace personnel client
├── cosmétiques.html      → Catalogue cosmétiques
├── contact.html          → Page de contact
└── ...
```

---

## ⚙️ Installation en local

1. Clone le dépôt :
   ```bash
   git clone https://github.com/omar14faye-collab/Tisanature.git
   ```
2. Place le dossier dans `htdocs` (si tu utilises XAMPP).
3. Crée la base de données via le script de structure fourni dans `SQL/` (schéma uniquement, sans données réelles).
4. Configure ta connexion à la base de données dans le dossier `configuration/` (copie `db.example.php` vers `db.php` et renseigne tes propres identifiants).
5. Lance Apache et MySQL via XAMPP, puis accède au site via `http://localhost/Tisanature`.

---

## 🔒 Sécurité

Les fichiers contenant des identifiants sensibles (base de données, clés de sécurité, sessions) ainsi que les exports de base de données avec de vraies données clients ne sont **pas inclus** dans ce dépôt, conformément aux bonnes pratiques de sécurité.

---

## 📄 Licence

Projet personnel — tous droits réservés.
