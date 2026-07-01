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
