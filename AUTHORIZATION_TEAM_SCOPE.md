# Autorisations CoachPulse par teamId

## Principe

Les donnees metier sont filtrees par `teamId`. Un utilisateur non admin doit avoir au moins une equipe dans `authorizedTeamIds` pour voir des donnees sportives.

Structure staff cible :

```json
{
  "uid": "...",
  "email": "...",
  "role": "ENTRAINEUR",
  "permissionLevel": "SAISIE",
  "authorizedTeamIds": ["team-u13-a"],
  "teamIds": ["team-u13-a"],
  "allowedTeamIds": ["team-u13-a"],
  "allowedModules": ["stats", "presences", "playerProfile"],
  "modulePermissions": {
    "stats": "edit",
    "presences": "edit",
    "playerProfile": "read"
  },
  "status": "ACTIVE"
}
```

`authorizedTeamIds`, `teamIds` et `allowedTeamIds` sont maintenus ensemble pour garder la compatibilite avec les anciennes versions.

## Regle d'acces

Le controle final combine toujours :

- compte actif ;
- equipe autorisee via `authorizedTeamIds` ;
- module autorise via `allowedModules` ou `modulePermissions` ;
- niveau d'action via `permissionLevel` ou `modulePermissions`.

Un role metier ne suffit pas a donner acces a une equipe.

## Joueuses

Une joueuse est accessible uniquement si son document, son historique de saison ou ses affectations contiennent un `teamId` present dans les equipes autorisees de l'utilisateur.

Le `playerId` seul ne suffit jamais a autoriser l'ouverture d'une fiche.

## Firestore

Les regles Firestore protegent les collections metier avec `teamId` ou `teamIds`.

Collections controlees :

- `teams`
- `players`
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
- `medicalFollowUps`
- `workloads`
- `convocations`
- `individualReports`

Les anciennes donnees sans `teamId` doivent etre migrees. Elles ne doivent pas rester durablement accessibles sans rattachement fiable.

## Cache local

A la deconnexion, CoachPulse supprime les caches sensibles de joueuses, fiches, presences, matchs et tests. A la connexion, les listes locales de joueuses sont purgees selon le profil connecte.

## Exemple

Utilisateur :

- role : entraineur ;
- `authorizedTeamIds` : `["team-u13-a"]` ;
- module `stats` : `edit` ;
- module `injuries` absent ou `none`.

Resultat :

- acces aux matchs U13 A en modification ;
- acces aux joueuses U13 A ;
- aucun acces aux blessures ;
- aucun acces aux equipes hors U13 A.

## Migration restante

Les documents historiques sans `teamId` doivent etre rattaches par ordre de fiabilite :

1. `matchId` vers le `teamId` du match ;
2. `sessionId` vers le `teamId` de la seance ;
3. `playerId` vers l'affectation de saison de la joueuse ;
4. validation manuelle si plusieurs equipes sont possibles.

Ne jamais rattacher uniquement par ressemblance du nom d'equipe.
