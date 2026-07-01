CoachPulse PWA V6.2 Sync Temps Réel

Installation Netlify :
1. Dézipper ce dossier.
2. Remplacer tous les fichiers de la version précédente sur Netlify.
3. Ouvrir le lien Netlify en navigation privée pour forcer le nouveau service worker V6.2.
4. Se connecter avec un compte Firebase existant.

Nouveautés V6.2 :
- Synchronisation automatique temps réel avec Firebase Firestore.
- Récupération cloud automatique dès la connexion.
- Sauvegarde locale automatique.
- Envoi cloud automatique dès qu’une modification est détectée.
- File d’attente locale si l’application est hors ligne.
- Resynchronisation automatique au retour d’Internet.
- État de synchronisation visible : Cloud synchronisé, hors ligne, sync en cours, erreur.
- Administration staff conservée.

Important :
- La suppression complète d’un utilisateur Firebase Authentication se fait encore depuis la console Firebase.
- Pour éviter l’ancien cache, tester d’abord en navigation privée après déploiement.
