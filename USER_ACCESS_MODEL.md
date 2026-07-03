# CoachPulse user access model

## Firestore collection

Users live in `staff_members/{uid}`.

Core fields:

- `uid`
- `name`
- `email`
- `role`
- `roleLabel`
- `teamIds`
- `allowedTeamIds`
- `allowedModules`
- `modulePermissions`
- `playerIds`
- `allowedPlayerIds`
- `status`
- `userType`

Valid `status` values are `ACTIVE`, `INACTIVE`, and `ARCHIVED`.

## Roles

- `ADMIN`
- `RESPONSABLE_CATEGORIE`
- `COACH`
- `PREPARATEUR_ATHLETIQUE`
- `MEDICAL`
- `OBSERVATEUR_STAFF`
- `LECTURE`
- `JOUEUSE_PARENT`

Legacy roles are still accepted during transition:

- `RESPONSABLE` -> `RESPONSABLE_CATEGORIE`
- `EDUCATEUR` -> `COACH`
- `STAFF` -> `OBSERVATEUR_STAFF`

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

1. Keep module visibility controlled by the main app.
2. Add `canEditModule()` checks inside each page before showing create/edit buttons.
3. Add `canAccessTeam()` and `canAccessPlayer()` filters when reading lists.
4. Keep Firestore rules as the final protection layer.
