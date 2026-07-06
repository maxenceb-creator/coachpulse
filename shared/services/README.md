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

Service partagé stable pour la base joueuses commune.

Responsabilités :
- normaliser une joueuse ;
- garantir un `playerId` stable ;
- lire le cache local `coachpulse:centralPlayers` ;
- lire Firestore `players` quand Firebase est disponible ;
- dédupliquer par `playerId` ;
- filtrer par recherche, catégorie, sous-catégorie, équipe et statut.
- créer ou mettre à jour une fiche joueuse ;
- archiver une fiche sans suppression ;
- fusionner deux fiches en transférant les références `playerId`.

Contrat modèle principal :
- `playerId` : identifiant stable et clé du document Firestore.
  - Il est indépendant de la catégorie sportive.
  - Une montée de saison, par exemple U10 vers U11, ne doit jamais changer le `playerId`.
  - Pour les nouvelles joueuses, il est généré à partir de l'identité stable, idéalement nom + prénom + date de naissance.
- `nom`, `prenom`, `displayName`.
- `categorie`, `subCategory`, `team`, `teamId`.
- `currentSeason`, `seasonStart`, `seasonEnd`, `seasonHistory`.
  - Une saison commence le 1er juillet et finit le 30 juin.
  - Exemple : `2026-2027` va du 1er juillet 2026 au 30 juin 2027.
  - La catégorie de saison est recalculée depuis la date de naissance quand elle est disponible.
- `poste`, `numero`, `photo`, `foot`, `birth`, `dateNaissance`.
- `status` : `active`, `injured`, `left` ou `archived`.
- `createdAtIso`, `updatedAtIso`, `updatedBy`, `updatedByEmail`.

Phase actuelle : `app.js` garde l'API historique `CoachPulseCentralData`, mais délègue progressivement lecture et écriture à ce service.

## teams-service.js

Service partagé pour les équipes, groupes d'âge et options de base.

Responsabilités :
- normaliser une équipe ;
- garantir un `teamId` stable ;
- lire et écrire Firestore `teams` ;
- lire et écrire `settings/database-options` ;
- fournir les catégories et sous-catégories officielles.

Contrat modèle principal :
- `teamId` : identifiant stable et clé du document Firestore.
- `name`.
- `category`.
- `subCategories`.
- `status`.
- `createdAtIso`, `updatedAtIso`, `updatedBy`, `updatedByEmail`.

## permissions-service.js

Service partagé pour les rôles et droits d'accès.

Responsabilités :
- normaliser le rôle utilisateur ;
- identifier Admin / Super Admin ;
- vérifier les permissions par module ;
- filtrer les modules visibles selon le rôle ;
- préparer le futur branchement Firebase Auth custom claims.

Phase actuelle : service ajouté sans retirer les fonctions historiques d'app.js.
