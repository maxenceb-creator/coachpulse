# Shared services

Services communs a extraire progressivement depuis `app.js` sans casser les modules existants.

Services cibles :

- `firebase-service.js` : acces Firestore, Hosting, Auth plus tard
- `players-service.js` : source officielle `players`
- `export-service.js` : exports CSV/JSON
- `cache-service.js` : fallback local si Firebase est indisponible
- `permissions-service.js` : roles et acces modules

Regle : un service partage ne doit pas dependre d'un module precis.

## players-service.js

Premier service partagé stable pour la base joueuses.

Responsabilités :
- normaliser une joueuse ;
- garantir un `playerId` stable ;
- lire le cache local `coachpulse:centralPlayers` ;
- lire Firestore `players` quand Firebase est disponible ;
- dédupliquer par `playerId` ;
- filtrer par recherche, catégorie, sous-catégorie, équipe et statut.

Phase actuelle : service ajouté sans remplacer brutalement les fonctions existantes.

