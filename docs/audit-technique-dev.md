# Audit technique dev CoachPulse

Date : 2026-07-21

Branche auditee : `dev`

## Etat general

CoachPulse est fonctionnel, mais la base reste hybride : un `app.js` central tres volumineux orchestre encore l'authentification, Firebase, les imports, la navigation, l'administration, la synchronisation et une partie de la logique metier. Plusieurs modules historiques sont encore des pages HTML autonomes avec JavaScript inline, tandis que les modules recents comme Fiche individuelle et Fiche equipe sont mieux separes.

La branche est exploitable pour continuer vers une V1, mais la phase esthetique doit rester progressive : toute refonte visuelle devra eviter de melanger design et migration metier.

## Problemes detectes

### Critiques ou importants

- Incoherence de collection staff : le code d'export central referencait `staff` alors que l'application, les regles Firestore et la gestion utilisateurs utilisent `staff_members`.
- Service worker incomplet : le precache ne contenait pas le module Fiche equipe ni le CSS responsive global, ce qui pouvait casser une navigation hors ligne ou apres installation PWA.
- Service worker trop permissif en cache dynamique : les reponses non valides pouvaient etre mises en cache.
- Plusieurs modules historiques lisent encore des caches locaux et melangent affichage, logique metier et stockage.
- `app.js` concentre trop de responsabilites, ce qui rend les regressions plus probables lors des evolutions.
- Certaines anciennes donnees peuvent encore necessiter une migration `teamId` fiable pour renforcer les regles sans compatibilite transitoire.

### Moyens

- Nombreux listeners et correctifs successifs dans `pages/methodologie.html`, ce qui augmente le risque de double rendu.
- Plusieurs helpers de saison/categorie/equipe existent encore dans des modules HTML, meme si les services centraux `players-service` et `teams-service` sont maintenant la source de reference.
- Les controles disponibles sont surtout syntaxiques. Il manque des tests automatises metier pour playerId, teamId, permissions, imports et exports.
- Le dossier `public/` est genere par `npm run build:public`; il est ignore par Git, mais peut preter a confusion en lecture locale.

### Mineurs

- Des fichiers locaux ignores peuvent apparaitre dans le workspace (`.DS_Store`, cache Firebase local).
- Certaines documentations anciennes parlaient encore de `staff`.
- Plusieurs pages contiennent encore beaucoup de CSS inline.

## Corrections effectuees

- Alignement de la collection staff centrale sur `staff_members`.
- Ajout des champs d'autorisations utiles dans l'export staff central : `authorizedTeamIds`, `teamIds`, `allowedTeamIds`, `allowedModules`, `modulePermissions`.
- Mise a jour du service worker :
  - nouveau nom de cache ;
  - ajout de `css/responsive.css` ;
  - ajout des fichiers du module Fiche equipe ;
  - mise en cache dynamique uniquement des reponses valides ;
  - protection silencieuse si l'ecriture cache echoue.
- Ajout d'un controle statique `scripts/audit-static.js`.
- Ajout du script npm `audit:static`.
- Mise a jour de `FIREBASE_STRUCTURE.md` pour remplacer `staff` par `staff_members`.

## Elements supprimes

Aucune fonctionnalite n'a ete supprimee.

Aucun fichier versionne n'a ete supprime. Les fichiers generes ou locaux restent ignores par `.gitignore`.

## Elements mutualises ou clarifies

- Clarification de la source staff unique : `staff_members`.
- Controle statique commun pour les fichiers critiques, les marqueurs de conflit et les assets PWA obligatoires.
- Le service worker reference maintenant les modules recents au meme niveau que les modules historiques.

## Fichiers principaux modifies

- `app.js`
- `sw.js`
- `package.json`
- `scripts/audit-static.js`
- `FIREBASE_STRUCTURE.md`
- `docs/audit-technique-dev.md`

## Tests et verifications realises

- `npm run check`
- `npm run audit:static`
- `npm run build:public`
- Verification syntaxique des fichiers JavaScript principaux.
- Verification syntaxique de tous les fichiers `.js` sources hors dossier genere `public/`.
- Verification statique des assets PWA critiques.
- Verification de l'absence de marqueurs de conflit.
- `git diff --check`

Limite : les tests navigateur complets et les tests Firebase Rules automatises ne sont pas encore disponibles dans le projet. La Firebase CLI locale signale aussi un probleme d'acces a son cache de configuration utilisateur lors de son auto-check. Le serveur local Python a demarre en IPv6 uniquement dans l'environnement de test, ce qui a empeche une validation `curl` IPv4, mais le build public a ete genere correctement.

## Modules verifies

Verification statique et structurelle :

- authentification et profil staff ;
- roles, permissions et restrictions `teamId` ;
- service worker PWA ;
- base centrale `playerId` ;
- Fiche individuelle ;
- Fiche equipe ;
- modules Matchs, Presences, Tests techniques, Tests athletiques et Suivi medical par recherche de dependances et de caches.

## Risques restant a traiter

- Ajouter des tests metier automatises pour :
  - acces utilisateur mono-equipe ;
  - acces utilisateur multi-equipes ;
  - joueur interdit par `playerId` direct ;
  - donnees sans `teamId` ;
  - permissions module `read/edit/none`.
- Isoler progressivement les grands modules HTML historiques en fichiers JS/CSS separes.
- Remplacer les helpers dupliques de saison/categorie/equipe par appels directs aux services centraux.
- Ajouter un test Firebase Rules automatise avec emulateur.
- Auditer plus finement les donnees historiques sans `teamId` avant de supprimer les compatibilites transitoires.

## Recommandations pour la phase design

1. Ne pas refaire toute l'interface en une seule PR.
2. Commencer par extraire un petit design system CSS partage : boutons, cards, tables, filtres, modales.
3. Appliquer ce systeme module par module, avec verification mobile a chaque etape.
4. Prioriser les modules recents et structurés : Fiche individuelle, Fiche equipe, Gestion utilisateurs.
5. Garder les changements metier hors des PR purement esthetiques.

## Conclusion

La branche `dev` est plus coherente apres cet audit. Les corrections apportees reduisent les risques PWA, clarifient la collection staff et ajoutent un controle statique reutilisable. Le chantier prioritaire restant est la decomposition progressive des pages historiques monolithiques et l'ajout de tests metier automatises.
