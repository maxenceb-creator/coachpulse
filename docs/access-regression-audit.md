# Audit non-regression des acces CoachPulse

## Objectif

Ce controle complete les PR de verrouillage `teamId` / `playerId` deja fusionnees dans `dev`.
Il ne change pas le comportement metier de l'application. Il ajoute un filet de securite pour verifier que les briques centrales d'autorisation restent presentes avant de continuer les evolutions.

## Surfaces verifiees

- Service central des permissions : acces equipe, acces joueuse, acces record, filtrage equipes, filtrage joueuses, filtrage donnees.
- Modules metier sensibles : matchs, presences, tests techniques, tests athletiques, medical, fiche individuelle, fiche equipe.
- Imports et exports globaux : validation avant ecriture et limitation des exports au perimetre autorise.
- Cache local et deconnexion : presence des fonctions de purge des donnees sensibles et des donnees non autorisees.
- Firestore rules : verrou central `canAccessScopedData`, controle de l'ancien et du nouveau perimetre lors des updates, bloc catch-all refuse.
- Base joueurs/equipes : collections rattachees au `playerId`, regle officielle `teamId`, surclassement U16 compatible avec U19.

## Corrections realisees

- Ajout du test `testAccessRegressionSurfaceStaysComplete` dans `scripts/regression-core.js`.
- Verification statique des exports d'autorisation exposes par `window.CoachPulseCentralData`.
- Verification statique des fonctions critiques de lecture, import, export, cache et securite Firestore.
- Ajout de ce rapport dans `docs/access-regression-audit.md`.

## Limites

Ce controle est volontairement statique. Il garantit que les verrous principaux restent presents dans le code, mais il ne remplace pas :

- un test manuel avec plusieurs comptes reels ;
- une verification dans Firebase Rules Simulator ou emulator ;
- une verification tablette/Safari avec cache PWA vide ;
- une verification de donnees historiques incompletes dans Firestore.

## Verification manuelle conseillee

1. Se connecter avec un admin et verifier l'acces global.
2. Se connecter avec un utilisateur limite a une equipe et verifier qu'il ne voit que ses donnees.
3. Ouvrir directement une fiche joueuse non autorisee par `playerId` et verifier le blocage.
4. Tester matchs, presences, tests techniques, tests athletiques, fiche individuelle et fiche equipe.
5. Verifier qu'apres deconnexion/reconnexion avec un autre compte, aucun cache interdit ne reste visible.
