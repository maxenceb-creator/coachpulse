# CoachPulse user access model

## Principle

User access is split into four independent parts:

- `role`: club function, used for identification only.
- `teamIds` / `allowedTeamIds`: sport scope.
- `allowedModules`: functional scope.
- `permissionLevel`: real action level in the app.

The role must not grant permissions by itself.

## Firestore collection

Users live in `staff_members/{uid}`.

Core fields:

- `uid`
- `name`
- `email`
- `role`
- `roleLabel`
- `permissionLevel`
- `permissionLabel`
- `teamIds`
- `allowedTeamIds`
- `allowedModules`
- `modulePermissions`
- `playerIds`
- `allowedPlayerIds`
- `status`
- `userType`

Valid `status` values are `ACTIVE`, `INACTIVE`, and `ARCHIVED`.

## Club roles

- `RESPONSABLE_POLE`
- `ENTRAINEUR`
- `ENTRAINEUR_ADJOINT`
- `PREPARATEUR_PHYSIQUE`
- `KINE`
- `MEDECIN`
- `DIRIGEANT`

Legacy roles are normalized during transition:

- `ADMIN` -> `DIRIGEANT`
- `RESPONSABLE` / `RESPONSABLE_CATEGORIE` -> `RESPONSABLE_POLE`
- `EDUCATEUR` / `COACH` -> `ENTRAINEUR`
- `PREPARATEUR_ATHLETIQUE` -> `PREPARATEUR_PHYSIQUE`
- `MEDICAL` -> `KINE`

## Permission levels

- `LECTEUR`: can read allowed modules.
- `SAISIE`: can read and write allowed modules.
- `EDITEUR`: can read, write and use advanced actions on allowed modules.
- `ADMIN`: can access every team, every module and every action.

Legacy permission migration:

- old `ADMIN` -> `ADMIN`
- old `RESPONSABLE`, `RESPONSABLE_CATEGORIE` -> `EDITEUR`
- old `LECTURE`, `OBSERVATEUR_STAFF`, `JOUEUSE_PARENT` -> `LECTEUR`
- other old staff roles -> `SAISIE`

## Shared helpers

Use `window.CoachPulsePermissionsService` for central checks:

```js
const permissions = window.CoachPulsePermissionsService;

permissions.canViewModule(userProfile, module);
permissions.canEditModule(userProfile, module);
permissions.canDeleteData(userProfile, moduleId);
permissions.canAccessTeam(userProfile, teamId);
permissions.canAccessPlayer(userProfile, player);
```

The main app also exposes the current access context to pages:

```js
window.CoachPulseCentralData.accessContext();
window.CoachPulseCentralData.canViewModule('medical');
window.CoachPulseCentralData.canEditModule('presences');
window.CoachPulseCentralData.canAccessTeam('U12-U13');
window.CoachPulseCentralData.canAccessPlayer(player);
```

Iframes receive a `postMessage` with `type: "coachpulse-access-context"` when access changes or a module loads.

## Progressive rollout

1. Keep module visibility controlled by `allowedModules`.
2. Use `permissionLevel` for read/write/editor behavior.
3. Keep team/player filtering through `teamIds`, `allowedTeamIds`, `playerIds`, and `allowedPlayerIds`.
4. Keep Firestore rules as the final protection layer.
