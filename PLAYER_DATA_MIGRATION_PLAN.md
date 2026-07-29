# Plan de migration propre - Base joueuses CoachPulse

Date de lancement : 2026-07-06

## Objectif

Reconstruire une base joueuses unique, fiable et durable, puis rattacher les historiques existants à cette nouvelle référence.

La migration ne doit pas supprimer les données existantes sans sauvegarde. Elle doit d'abord produire une simulation lisible, puis une validation humaine, puis seulement une écriture contrôlée dans Firebase.

## Constats de départ

Dernier export Firebase identifié :

- `/Users/sylvainostard/Downloads/coachpulse_firebase_centralise-6.json`

Contenu de cet export :

- `players` : 370 fiches
- `attendance` : 3997 lignes
- `technicalTests` : 921 lignes
- `sessions` : 180 lignes
- `teams` : 13 lignes
- `changeLogs` : 2 lignes
- collections médicales et matchs : 0 ligne dans cet export

Source joueuses propre identifiée :

- `/Users/sylvainostard/Desktop/ASSE/coachpulse-joueuses-import-coachpulse-safe.json`
- 127 joueuses
- 97 fiches avec photo intégrée ou source photo

## Principe retenu

On ne corrige plus la base par petites fusions successives. On passe sur une migration propre en quatre couches :

1. Sauvegarde complète de l'existant.
2. Création d'un référentiel `players` propre.
3. Remapping des historiques vers les nouveaux `playerId`.
4. Validation puis bascule.

## Règle d'identité joueuse

Chaque joueuse doit avoir un `playerId` unique et stable.

Règle recommandée :

```text
playerId = player-{nom normalisé}-{prenom normalisé}-{date naissance}
```

Exemple :

```text
player-solerlouise-2020-02-04
```

Règles :

- `nom` en majuscules.
- `prenom` en majuscules.
- `displayName` en format `PRENOM NOM`.
- `birth` obligatoire quand disponible.
- `dateNaissance` conserve la même valeur que `birth`.
- `categorie`, `subCategory` et `team` sont calculées depuis la saison active.
- `photo` est portée uniquement par la fiche joueuse, jamais copiée module par module.

## Saisons

La saison 2026-2027 commence le 2026-07-01 et se termine le 2027-06-30.

Règle automatique :

- une joueuse U10 en 2025-2026 devient U11 en 2026-2027 ;
- une joueuse U11 en 2025-2026 devient U12 en 2026-2027 ;
- etc.

Chaque donnée métier doit porter un champ `season`.

Les modules doivent permettre :

- saison courante ;
- saison précédente ;
- toutes saisons.

## Collections à sauvegarder

Avant toute écriture, exporter et conserver :

- `players`
- `teams`
- `matches`
- `matchEvents`
- `sessions`
- `attendance`
- `technicalTests`
- `physicalTests`
- `injuries`
- `injuryUpdates`
- `medicalAppointments`
- `rehabRoutines`
- `workloads`
- `convocations`
- `medicalFollowUps`
- `individualReports`
- `settings`
- `syncLogs`
- `changeLogs`

## Collections de travail proposées

Pour éviter une bascule brutale, la migration doit d'abord écrire dans des collections temporaires :

- `migrationPlayers`
- `migrationSessions`
- `migrationAttendance`
- `migrationTechnicalTests`
- `migrationPhysicalTests`
- `migrationInjuries`
- `migrationReports`

Une fois validées, ces collections pourront remplacer ou réalimenter les collections officielles.

## Stratégie de remapping historique

Chaque historique ancien doit être rattaché à une joueuse propre via une clé de correspondance.

Priorité de matching :

1. Ancien `playerId` déjà relié à un nouveau `playerId` validé.
2. `nom + prenom + birth`.
3. `nom + prenom` seulement si une seule correspondance existe.
4. Validation manuelle obligatoire si plusieurs candidates existent.

Interdiction :

- ne jamais fusionner automatiquement deux noms ressemblants ;
- ne jamais fusionner `JASMINE P POL` avec `JASMINE POL` sans validation humaine ;
- ne jamais supprimer un historique non mappable.

Les historiques non mappés doivent partir dans un rapport `unmapped`.

## Ordre d'exécution

### Phase 0 - Gel

- Bloquer les imports manuels pendant la migration.
- Exporter Firebase complet.
- Conserver le fichier export avec horodatage.

### Phase 1 - Référentiel propre

- Lire `coachpulse-joueuses-import-coachpulse-safe.json`.
- Normaliser les 127 joueuses.
- Générer les `playerId` uniques.
- Vérifier doublons internes.
- Vérifier photos.
- Vérifier catégories/sous-catégories 2026-2027.

Livrable : rapport `players-clean-report`.

### Phase 2 - Simulation historique

- Lire l'export Firebase existant.
- Construire une table `oldPlayerId -> newPlayerId`.
- Simuler le remapping de :
  - `attendance`
  - `technicalTests`
  - `physicalTests`
  - `matchEvents`
  - `injuries`
  - `injuryUpdates`
  - `medicalAppointments`
  - `rehabRoutines`
  - `workloads`
  - `convocations`
  - `individualReports`
- Compter :
  - historiques remappés ;
  - historiques non mappés ;
  - collisions ;
  - joueuses sources introuvables.

Livrable : rapport `history-remap-report`.

### Phase 3 - Pré-écriture

- Écrire dans les collections temporaires `migration*`.
- Ne pas toucher aux collections officielles.
- Tester l'application sur ces collections si possible, ou exporter le résultat pour contrôle.

Livrable : base temporaire inspectable.

### Phase 4 - Bascule

Après validation humaine :

- archiver l'ancien `players` ou le copier en backup ;
- remplacer `players` par la nouvelle base ;
- remplacer les historiques officiels par les versions remappées ;
- créer un `changeLogs` global de migration.

## Critères d'acceptation

La migration est validée seulement si :

- 127 joueuses actives propres sont présentes ;
- aucun doublon strict n'existe dans `players`;
- chaque joueuse a un `playerId` stable ;
- les photos apparaissent dans tous les modules via `players`;
- les catégories 2026-2027 sont cohérentes ;
- les présences sont visibles ;
- les tests affichent photos et catégories correctes ;
- les blessures utilisent la même liste joueuses ;
- chaque historique remappé pointe vers un `playerId` existant ;
- les historiques non mappés sont listés dans un rapport.

## Rollback

Si la migration échoue :

1. Ne pas supprimer les exports.
2. Restaurer les collections depuis l'export Firebase initial.
3. Conserver le rapport d'erreur.
4. Corriger la règle de mapping.
5. Relancer uniquement la simulation.

## Prochaine action technique

Créer un outil de simulation local qui prend :

- l'export Firebase complet ;
- le JSON joueuses propre ;

et produit :

- `migration-plan.json`
- `players-clean-report.md`
- `history-remap-report.md`
- `unmapped-history.json`

Cet outil doit rester en lecture seule tant que la simulation n'est pas validée.
