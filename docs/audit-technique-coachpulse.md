# Audit technique CoachPulse

Date: 2026-07-29  
Branche auditee: `dev` apres integration de la PR #47  
Branche de travail: `codex/refactor-audit-nettoyage-global`

## Resume executif

CoachPulse est dans un etat fonctionnel et coherent pour continuer les evolutions, mais la base reste marquee par plusieurs zones historiques volumineuses. Les services `players`, `teams` et `permissions` donnent une bonne base pour centraliser `playerId`, `teamId` et les droits. Le deploiement Firebase publie bien le dossier `public`, ce qui limite le risque de publier des fichiers de travail.

Le principal risque avant une V1 large n'est pas une erreur bloquante immediate, mais la maintenabilite: `app.js`, le module Matchs et le module Bilans & planning concentrent encore beaucoup de responsabilites, de rendu HTML, de logique metier et de correctifs successifs dans les memes fichiers.

Niveau de maintenabilite estime: 6/10.  
Preparation V1: possible apres revue, mais avec une surveillance forte sur Matchs, PWA/cache, droits par `teamId` et fiche individuelle.

## Perimetre analyse

- 77 fichiers analyses hors dossiers generes `public/`, `output/`, `node_modules/` et assets binaires.
- 13 115 lignes mesurees sur les principaux fichiers HTML, CSS, JavaScript, Firebase et scripts.
- Modules parcourus: accueil, gestion joueuses/base, Data Hub, Matchs, Presences, Tests techniques, Tests athletiques, Bilans & planning, Suivi medical, Fiche individuelle, Fiche equipe, permissions, PWA et Firebase.

## Points positifs

- `firebase.json` publie uniquement `public` et execute `npm run build:public` avant de deployer.
- `public/` est ignore par Git et reconstruit a partir des sources.
- Le service worker utilise une strategie network-first pour les fichiers critiques de l'application, ce qui reduit les risques d'ancienne version bloquee sur tablette.
- Les services `shared/services/players-service.js`, `teams-service.js` et `permissions-service.js` structurent deja les regles communes.
- Les collections centrales et modules recents utilisent mieux `playerId` et `teamId`.
- Les controles disponibles passent: syntaxe JavaScript, audit statique et generation du dossier public.

## Problemes detectes

### Critique

Aucun probleme critique bloquant n'a ete confirme pendant cet audit statique. Aucun marqueur de conflit n'a ete detecte dans les fichiers critiques controles.

### Eleve

#### `app.js` trop volumineux

Fichier concerne: `app.js`  
Description: le fichier contient encore l'authentification, la navigation, la synchronisation, l'administration, l'import, les modales, la gestion manuelle des joueuses et une partie du rendu.  
Impact: chaque modification augmente le risque de regression transversale.  
Correction appliquee: aucune refactorisation lourde dans cette PR, car le risque est trop large.  
Statut: a traiter dans une PR dediee.

#### Module Matchs tres dense

Fichier concerne: `pages/coach-stats.html`  
Description: le module combine terrain, chronometre, heatmaps, compositions, bandeaux, styles embarques et scripts de compatibilite.  
Impact: les ajustements visuels ou fonctionnels peuvent casser le mode match, les positions ou les heatmaps.  
Correction appliquee: aucun changement fonctionnel. Le risque est documente.  
Statut: a traiter progressivement par sous-zones.

#### Bilans & planning avec correctifs empiles

Fichier concerne: `pages/methodologie.html`  
Description: plusieurs blocs styles/scripts versionnes cohabitent dans le meme fichier avec des initialisations retardees.  
Impact: risque d'ecouteurs multiples, rendu repete et comportement difficile a verifier.  
Correction appliquee: aucun changement fonctionnel.  
Statut: a traiter dans une PR de modularisation.

### Moyen

#### IDs HTML dupliques dans des paires style/script

Fichiers concernes: `pages/coach-stats.html`, `pages/methodologie.html`  
Description: certains identifiants sont utilises a la fois sur un bloc `<style>` et un bloc `<script>`.  
Impact: faible au runtime tant que le code ne cible pas ces IDs, mais cela rend le DOM invalide et fragilise les outils.  
Correction appliquee: l'audit statique remonte ces doublons en avertissement.  
Statut: non corrige dans cette PR pour eviter une modification large sans test visuel.

#### Usage important de `innerHTML`

Fichiers concernes: `app.js`, `pages/*.html`, `pages/player-profile/*.js`, `pages/team-profile/*.js`  
Description: le rendu dynamique repose souvent sur `innerHTML`. Plusieurs usages echappent correctement les donnees, mais cette discipline doit rester constante.  
Impact: risque XSS si une future saisie utilisateur est injectee sans echappement.  
Correction appliquee: aucune suppression automatique.  
Statut: a surveiller.

#### Logiques de normalisation encore reparties

Fichiers concernes: modules Presences, Tests techniques, Tests athletiques, Suivi medical, Fiche individuelle  
Description: des fallbacks locaux existent encore autour des joueuses, categories, saisons et equipes.  
Impact: risque d'ecart avec les services centraux `playerId`/`teamId`.  
Correction appliquee: aucune modification pour ne pas changer le comportement metier.  
Statut: a traiter par module.

#### Donnees volumineuses embarquees

Fichier concerne: `pages/tests-techniques.html`  
Description: le module contient encore un volume important de donnees et photos integrees au fichier.  
Impact: poids de chargement et lisibilite du code.  
Correction appliquee: aucune suppression, car cela peut servir de fallback historique.  
Statut: a migrer prudemment vers une source de donnees separee.

### Faible

#### Dossier local `output/` non ignore

Fichier concerne: `.gitignore`  
Description: le dossier local `output/` pouvait apparaitre comme fichier non suivi.  
Impact: risque d'ajout accidentel de documents generes.  
Correction appliquee: ajout de `output/` dans `.gitignore`.  
Statut: corrige.

#### Messages utilisateur via `alert`

Fichier concerne: `app.js`  
Description: de nombreux retours utilisent `alert`.  
Impact: experience utilisateur moins fluide, surtout tablette/mobile.  
Correction appliquee: aucune, car cela changerait le comportement visible.  
Statut: recommandation future.

### Amelioration

#### Audit statique renforce

Fichier concerne: `scripts/audit-static.js`  
Description: le controle verifie maintenant plus de points de stabilite: strategie PWA network-first, publication Firebase via `public`, predeploy, fichiers sensibles evidents et doublons d'IDs HTML en avertissement.  
Impact: meilleure detection avant fusion.  
Correction appliquee: controle renforce sans modification fonctionnelle.  
Statut: corrige.

## Nettoyage realise

- Ajout de `output/` dans `.gitignore`.
- Renforcement de `scripts/audit-static.js`.
- Ajout du present rapport d'audit.
- Aucun fichier metier supprime.
- Aucun changement de donnees Firebase ou Firestore.
- Aucun changement volontaire de design.
- Aucun changement volontaire de comportement fonctionnel.

## Dette technique restante

- Decouper `app.js` en modules plus petits: authentification, navigation, modales, import, synchro, administration.
- Extraire progressivement le module Matchs en fichiers dedies: etat, terrain, chrono, heatmaps, composition, persistence.
- Extraire les blocs versionnes de `pages/methodologie.html` vers des fichiers JS/CSS dedies.
- Remplacer progressivement les rendus `innerHTML` sensibles par des fonctions de rendu centralisees et echappees.
- Centraliser definitivement les fallbacks saison/categorie/equipe dans les services.
- Ajouter de vrais tests de non-regression sur `playerId`, `teamId`, permissions, fiche individuelle et heatmaps.
- Ajouter des tests tablette/PWA automatises ou au minimum une procedure manuelle stable.

## Resultats des tests

Commandes executees:

- `npm run check`: reussi.
- `npm run audit:static`: reussi avec avertissements sur IDs HTML dupliques historiques.
- `npm run build:public`: reussi.

Tests impossibles ou non executes:

- Pas de suite `npm test` declaree dans `package.json`.
- Pas de commande `npm run lint` declaree dans `package.json`.
- Pas de test end-to-end automatise disponible.
- Pas de verification manuelle complete sur tablette physique pendant cette PR.

Verification manuelle par lecture:

- `firebase.json` publie `public`.
- `sw.js` garde une strategie network-first pour les fichiers shell critiques.
- Aucune trace de fichier `.env`, service account, token ou cle privee versionnee n'a ete detectee par le controle statique.
- La cle Firebase visible dans `app.js` correspond a une configuration web publique, pas a une cle serveur privee.

## Recommandations pour les prochaines PR

1. PR de modularisation de `app.js`, sans changement visuel.
2. PR dediee au module Matchs: separer chrono, terrain, composition et heatmaps.
3. PR dediee a Bilans & planning pour sortir les styles/scripts versionnes.
4. PR de tests minimum sur `playerId`, `teamId`, permissions et fiche individuelle.
5. PR PWA/tablette avec tests reels sur iPad/tablette Android et controle du cache.
6. PR design globale seulement apres reduction de ces zones de risque.

## Conclusion

La branche peut etre revue comme une PR de securisation et de documentation. Elle ne resout pas toute la dette technique, mais elle ajoute des garde-fous sans modifier le comportement metier.
