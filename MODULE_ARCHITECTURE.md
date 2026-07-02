# Architecture modulaire CoachPulse

CoachPulse utilise maintenant un registre de modules dans `app.js`.

Chaque module est décrit avec :

- `id` : identifiant stable du module.
- `name` : nom affiche dans la navigation.
- `icon` : icone du module.
- `section` : `staff`, `admin` ou `future`.
- `active` : visible ou inactif.
- `collection` : collection Firestore principale.
- `relatedCollections` : collections liees.
- `screen` : ecran principal, interne ou iframe HTML.
- `permissions` : roles autorises pour lire, modifier, importer/exporter.
- `settings` : options d'affichage et parametres propres au module.

Modules actifs actuels :

- `stats` -> `matches` / `matchEvents`
- `presences` -> `attendance` / `sessions`
- `tests` -> `technicalTests` / `physicalTests`
- `methodologie` -> `sessions`
- `database` -> `players`
- `dataHub` -> `syncLogs`
- `admin` -> `staff`
- `medical` -> `injuries` / `injuryUpdates` / `medicalAppointments` / `rehabRoutines`

Modules prepares mais inactifs :

- `injuries` -> `injuries`
- `workload` -> `workloads`
- `convocations` -> `convocations`
- `individualReports` -> `individualReports`

Module medical :

- ecran : `pages/suivi-medical.html`
- collection principale : `injuries`
- mises a jour chronologiques : `injuryUpdates`
- rendez-vous : `medicalAppointments`
- routines / restrictions : `rehabRoutines`
- lien joueuse obligatoire : `playerId`
- export complet reserve aux roles admin.

Pour ajouter un module :

1. Ajouter une entree dans `DEFAULT_MODULE_REGISTRY`.
2. Creer la page HTML dans `pages/` si le module utilise une iframe.
3. Associer la collection Firestore principale.
4. Definir les permissions par role.
5. Activer `active:true` et `settings.showInNav:true`.
6. Ajouter un connecteur Data Hub si le module importe Excel/CSV/JSON.

Les modules lisent tous la meme base commune `players`, `teams` et `settings`.

## Structure cible progressive

La migration doit se faire module par module. Les pages historiques dans `pages/` restent fonctionnelles tant que leur equivalent modulaire n'est pas pret.

Structure preparee :

- `modules/dashboard/` : accueil et indicateurs staff
- `modules/matchs/` : prise de stats et evenements de match
- `modules/joueuses/` : fiches joueuses et liens `playerId`
- `modules/medical/` : suivi medical central
- `modules/blessures/` : vues dediees blessures si separees du medical
- `modules/presences/` : seances et attendance
- `modules/tests-techniques/` : tests techniques
- `modules/tests-athletiques/` : tests physiques / athletiques
- `modules/charge-travail/` : charge et bien-etre
- `modules/rapports/` : bilans et exports
- `modules/administration/` : base de donnees et droits
- `modules/parametres/` : configuration application

Dossiers partages :

- `shared/components/` : composants reutilisables
- `shared/services/` : acces Firebase, cache, exports
- `shared/utils/` : normalisation, dates, formats
- `shared/ui/` : helpers visuels
- `css/` : theme global, layout, composants
- `js/` : router, bootstrap, configuration

Regle de migration : ne deplacer un module dans `modules/` que lorsqu'il est teste et que son ancienne page est encore disponible comme fallback.

## Contrat `module.json`

Chaque dossier dans `modules/` contient maintenant un fichier `module.json`. Ce fichier sert de contrat avant migration complete.

Champs principaux :

- `id` : identifiant stable du module.
- `name` : nom lisible.
- `status` : `active-legacy`, `active-shared` ou `planned`.
- `firebase.collection` : collection Firestore principale.
- `firebase.relatedCollections` : collections liees.
- `permissions` : roles autorises.
- `routing.currentScreen` : page actuelle encore utilisee.
- `routing.targetEntry` : future entree modulaire.
- `migration.strategy` : strategie de migration progressive.

Les manifestes ne changent pas encore le fonctionnement de l'application. Ils documentent les frontieres et preparent le futur router modulaire.

## Ordre de migration conseille

1. Extraire les services partages sans toucher au visuel : `players`, permissions, exports.
2. Migrer un petit module peu risque vers `modules/` en gardant son ancienne page comme fallback.
3. Migrer `presences`, puis `tests`, puis `medical`.
4. Migrer `matchs` en dernier, car c'est le module le plus sensible en direct.
5. Une fois les modules stabilises, reduire progressivement `app.js`.

