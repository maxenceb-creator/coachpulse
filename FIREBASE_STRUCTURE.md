# CoachPulse - Structure Firestore centrale

Cette version garde les écrans existants en local-first, mais ajoute une base Firestore normalisée. Firebase devient la source officielle progressivement, sans casser les anciennes données locales.

## Collections

- `players` : base officielle des joueuses.
  - ID stable : `playerId`
  - Champs principaux : `prenom`, `nom`, `displayName`, `categorie`, `subCategory`, `team`, `teamId`, `foot`, `birth`, `photo`, `status`, `source`
- `teams` : équipes et groupes d'âge.
  - ID stable : `teamId`
  - Champs principaux : `name`, `category`, `source`
- `matches` : fiche d'un match.
  - ID stable : `matchId`
  - Champs principaux : `date`, `team`, `opponent`, `score`, `competition`
- `matchEvents` : actions du match.
  - ID stable : `eventId`
  - Champs principaux : `matchId`, `playerId`, `team`, `minute`, `action`, `zone`
- `sessions` : séances créées depuis Présences ou Méthodologie.
  - ID stable : `sessionId`
  - Champs principaux : `date`, `start`, `end`, `duration`, `type`, `theme`, `categories`, `team`
- `attendance` : présence d'une joueuse à une séance.
  - ID stable : `attendanceId`
  - Champs principaux : `sessionId`, `playerId`, `status`, `minutes`, `note`, `date`
- `technicalTests` : résultats techniques.
  - ID stable : `testId`
  - Champs principaux : `playerId`, `playerName`, `date`, `season`, `categorie`, `subCategory`, `tests`, `objectifs`
- `physicalTests` : réservé aux tests physiques.
- `staff` : profils staff normalisés.
  - ID stable : `staffId`
  - Champs principaux : `uid`, `email`, `name`, `role`, `scope`, `status`
- `settings` : configuration et version du schéma.

## Migration progressive

Le bouton `Migrer Firestore` du panneau Cloud lit les données locales existantes puis crée ou met à jour les documents Firestore.

Les anciennes données locales restent conservées :

- `coachpulse_common_base` continue de servir de sauvegarde globale de compatibilité.
- `coachpulse:centralPlayers` sert de cache local des joueuses Firebase pour les modules HTML existants.
- `coachpulse:customPlayers` reste le cache des joueuses ajoutées hors ligne.

## Import Excel/CSV

Le panneau `Import / Base de données` permet d'importer `.xlsx`, `.csv` et `.json` côté navigateur.

Le module `Data Hub` est maintenant l'espace dédié aux imports structurés. Il utilise des connecteurs séparés dans `connectors/`.

Premier connecteur disponible :

- `connectors/fichesJoueusesConnector.js`
  - détecte les colonnes de fiches joueuses;
  - lit la valeur calculée des cellules Excel quand elle existe;
  - signale les formules détectées et les formules sans valeur exploitable;
  - renvoie des objets standardisés `type: "player"`;
  - prépare `playerId`, catégorie, sous-catégorie, poste, photo et date de naissance.

Deuxième connecteur disponible :

- `connectors/presencesConnector.js`
  - détecte les colonnes joueuse, catégorie, date, statut, durée, charge et thème;
  - accepte les tableaux avec une date par colonne;
  - gère les statuts `P`, `R`, `ANJ`, `AJ`, `M`, `B`, `PO`, `D`;
  - renvoie des objets standardisés `type: "player"`, `type: "session"` et `type: "attendance"`;
  - prépare `playerId`, `sessionId` et `attendanceId`;
  - signale les lignes sans statut reconnu, les joueuses incomplètes et les doublons de présence.

Connecteurs tests disponibles :

- `connectors/testsTechniquesConnector.js`
  - détecte les joueuses et les résultats techniques;
  - accepte un format avec colonnes `Test`, `Valeur`, `Unité`;
  - accepte aussi un format large avec plusieurs tests en colonnes;
  - renvoie `type: "technicalTest"` et prépare `testId`.

- `connectors/testsPhysiquesConnector.js`
  - détecte les joueuses et les résultats physiques;
  - reconnaît les colonnes de type vitesse, sprint, VMA, endurance, force, détente, agilité;
  - accepte aussi un format large avec plusieurs tests en colonnes;
  - renvoie `type: "physicalTest"` et prépare `testId`.

Les prochains connecteurs prévus suivront le même modèle :

- `methodologieConnector.js`.

Chaque synchronisation Data Hub crée un document dans `syncLogs` avec le fichier, le connecteur, les créations, les mises à jour, les ignorés, les erreurs et les anomalies principales.

## Administration / Base de données

La page `pages/admin-database.html` permet de gérer la collection `players` directement dans CoachPulse.

Fonctions disponibles dans ce premier lot :

- lecture Firestore de `players`;
- recherche par nom/prénom;
- filtres catégorie, sous-catégorie, équipe, poste et statut;
- ouverture d'une fiche joueuse;
- modification des champs autorisés : nom, prénom, naissance, catégorie, sous-catégorie, équipe, poste, numéro, photo, statut et commentaire interne;
- archivage et réactivation sans suppression;
- export `players` en JSON et CSV;
- export Firebase complet;
- panneau qualité : catégorie manquante, sous-catégorie manquante, naissance manquante, équipe manquante, noms incohérents, doublons potentiels.

Fusion de doublons :

- choix manuel d'une fiche principale à conserver;
- choix manuel d'une fiche doublon à archiver;
- transfert des références `playerId` de la fiche doublon vers la fiche principale dans `matchEvents`, `attendance`, `technicalTests` et `physicalTests`;
- remplissage de quelques champs manquants sur la fiche principale quand la fiche doublon les possède;
- archivage de la fiche doublon avec `mergedIntoPlayerId`;
- aucune suppression définitive;
- création d'un log `changeLogs` avec le détail des références transférées.

Extension équipes / catégories :

- consultation de `teams`;
- ajout d'une équipe;
- modification du nom d'une équipe;
- association simple équipe → catégorie;
- gestion des listes officielles dans `settings/database-options`;
- catégories recommandées : `U7`, `U8-U9`, `U10-U11`, `U12-U13`, `U12-U13-U14`, `U14-U15-U16`, `U19`, `R1`;
- sous-catégories recommandées : `U7`, `U8`, `U9`, `U10`, `U11`, `U12`, `U13`, `U14`, `U15`, `U16`, `U19`, `R1`;
- suppression automatique interdite : une correction crée ou met à jour, puis écrit un log.

Chaque modification crée un document dans `changeLogs` :

- `type` : `update`, `archive`, `create` ou `merge`;
- `collection` : `players`, `teams` ou `settings`;
- `documentId` : `playerId`, `teamId` ou `database-options`;
- `changes` : champs avant/après;
- `updatedAtIso`;
- `updatedBy` et `updatedByEmail`;
- `summary` lisible.

Règles de sécurité :

- aucune suppression définitive de joueuse;
- une joueuse qui part doit passer en `left` ou `archived`;
- le `playerId` n'est jamais modifié depuis l'interface;
- les historiques de matchs, présences et tests restent donc liés à la même joueuse;
- en cas de fusion, seul le `playerId` conservé devient la référence commune dans les modules.

La fonction `CoachPulseCentralData.importPlayerRowsToFirestore(rows, options)` prépare l'import :

- conversion des lignes en documents `players`;
- génération d'un `playerId` stable avec nom, prénom, catégorie et sous-catégorie;
- regroupement automatique par `teamId`;
- mode `dryRun` possible pour prévisualiser sans écrire;
- écriture Firestore en fusion, sans suppression des champs existants.

La fonction `CoachPulseCentralData.buildImportPlan(rows, options)` analyse les colonnes et prépare :

- `players` et `teams`;
- `sessions` et `attendance` quand des statuts de présence sont détectés;
- `technicalTests` quand les colonnes ressemblent à des tests techniques;
- `physicalTests` quand les colonnes ressemblent à des tests physiques.

Les libellés d'en-têtes sont volontairement souples : `joueuse`, `nom complet`, `player`, `catégorie`, `équipe`, `présence`, `résultat`, `test`, etc. sont reconnus même si les fichiers ne partagent pas exactement les mêmes en-têtes.

Avant écriture, l'import :

- nettoie les espaces;
- harmonise les noms et prénoms;
- harmonise les catégories et sous-catégories;
- détecte les lignes vides ou sans joueuse;
- compare les joueuses existantes depuis `players`;
- met à jour seulement les champs manquants;
- ne supprime jamais de document Firebase.

Une simulation est obligatoire dans l'interface avant l'import réel. Un export JSON Firebase est déclenché avant une écriture réelle pour conserver un backup.

## Exports

Le panneau Cloud propose :

- `Export Firebase JSON` : export complet des collections centrales;
- `Export Firebase CSV` : export global aplati, compatible tableur;
- `Export global` : sauvegarde historique de compatibilité localStorage.
