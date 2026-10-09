# CoachPulse — Phase 0B — constat confidentiel

Diffusion limitée au responsable du projet et au référent RGPD. Ce document ne contient aucune donnée personnelle.

## Constat

- Les deux pages publiques ciblées contenaient des inventaires nominatifs intégrés au JavaScript statique, avec des attributs d'identité, de naissance, sportifs et des photographies encodées.
- `scripts/build-public.js` copiait ces pages sans transformation vers l'artefact Firebase Hosting.
- `sw.js` précachait directement les deux pages. Les anciennes versions pouvaient donc rester dans un cache navigateur CoachPulse jusqu'à l'activation d'un nouveau service worker.
- Le commit de production indiqué (`41ddd795de6df3eae532ea491c5b150528899232`) et la branche `origin/dev` contiennent les blocs concernés.
- L'introduction historique des deux blocs remonte au commit initial `38616b0` (2026-07-01). L'historique Git n'a pas été réécrit.

## Correction préparée

- Les inventaires embarqués sont remplacés par des états initiaux vides.
- Les données opérationnelles continuent d'être chargées par les API centrales existantes après authentification, vérification du module et filtrage du périmètre d'équipes.
- Les sauvegardes locales, files d'attente de synchronisation et données hors ligne ne sont pas supprimées.
- La nouvelle version du service worker supprime, à son activation, tous les anciens caches dont le nom est contrôlé par CoachPulse. Elle ne touche ni `localStorage` ni IndexedDB.
- Le build vérifie avant et après copie les deux pages concernées et échoue sans afficher le contenu détecté.

## Éléments restant à évaluer

- Déterminer, à partir des journaux d'hébergement disponibles, la période exacte d'exposition et les accès éventuels. Cette vérification n'a pas été possible depuis le dépôt.
- Considérer toute ancienne URL de déploiement ou de preview comme potentiellement concernée tant qu'elle n'a pas été vérifiée ou retirée de manière contrôlée.
- Après validation de la correction, déployer rapidement la version corrigée afin que le nouveau service worker puisse activer le nettoyage des caches gérés.
- Évaluer avec le référent RGPD les obligations de documentation et, le cas échéant, de notification. Éviter de placer des éléments sensibles dans une issue publique.
- Décider séparément si une réécriture coordonnée de l'historique Git est nécessaire. Ne pas la faire sans plan de rotation des clones, branches, tags et artefacts.

## Préservation des données

Aucune donnée Firestore n'a été supprimée ou migrée par cette correction. Les données historiques intégrées ont été retirées du code public seulement après confirmation que les modules disposent déjà de leurs sources Firebase et de leurs mécanismes locaux de reprise/synchronisation.
