# Audit performance — fluidité CoachPulse

Date : 2 septembre 2026  
Base auditée : `origin/dev` (`247493f`)  
Branche : `codex/perf-fluidity-dev`

## Méthode et limites

L'audit combine inspection des chemins d'exécution, gardes de régression, audit statique et contrôle navigateur local aux largeurs desktop (1280 px) et tablette (768 px). Les nombres de requêtes ci-dessous sont déduits des appels Firestore présents dans le chemin exécuté et vérifiés par les tests de structure ; ils ne sont pas présentés comme des latences réseau.

L'environnement ne fournit pas d'identifiants Firebase de test. Les scénarios authentifiés, le nombre facturé de documents lus et les durées réseau réelles ne peuvent donc pas être mesurés ici sans inventer de chiffres. Une instrumentation activable avec `localStorage.setItem('coachpulse:debugPerf', '1')` permet de les relever sur le canal dev via `window.CoachPulsePerf.snapshot()`.

## Diagnostic initial — cinq goulets principaux

| Rang | Goulet | Impact utilisateur | Coût/fréquence observables | Risque de correction | Confiance |
|---|---|---|---|---|---|
| 1 | Connexion bloquée par `syncCloud(false)` puis un rafraîchissement forcé des joueuses | Très élevé : aucun module utilisable avant leur fin | 2 opérations réseau non liées à la sécurité, à chaque connexion | Faible à moyen | Élevée |
| 2 | Fiche individuelle préchargeant toutes les autres joueuses, équipe après équipe | Très élevé sur réseau et quota Firestore | Jusqu'à 15 collections ciblées par joueuse non consultée, après la première sélection | Faible | Élevée |
| 3 | Cache PWA intégralement supprimé à chaque lancement en ligne | Élevé au lancement et au retour dans un module | À chaque lancement, même sans changement de version | Faible | Élevée |
| 4 | Tests techniques forçant une relecture au chargement et toutes les 15 s au focus/retour visible | Élevé sur les tablettes et connexions lentes | Lecture complète logique répétée malgré un cache mémoire de 5 min | Faible | Élevée |
| 5 | Fiche équipe préchargeant deux équipes non demandées après la première sélection | Moyen à élevé | Deux chargements synthétiques Firestore supplémentaires par session de fiche | Faible | Élevée |

## Causes racines et corrections

### Démarrage

Le profil et les permissions restent bloquants. Après leur validation, le cache local est purgé selon le nouveau périmètre avant l'affichage. L'interface est ensuite déverrouillée et routée immédiatement ; synchronisation cloud et actualisation ciblée des joueuses s'exécutent en parallèle en arrière-plan. Le `forceRefresh` de connexion a été supprimé, sans modifier les requêtes `teamId`/`teamIds` du service joueuses.

### Fiches joueuse et équipe

Le cache mémoire par `playerId`/`teamId` existant est conservé. Les préchargements spéculatifs inter-joueuses et inter-équipes sont supprimés : seules les fiches demandées sont chargées, et un retour sur une fiche déjà consultée réutilise son cache. Le chargement synthétique puis détaillé de l'équipe sélectionnée reste inchangé.

### Tests techniques

Une ouverture normale utilise désormais le cache mémoire de cinq minutes. Une actualisation explicite ou un retour visible après soixante secondes peut toujours revalider les données. Les écritures continuent d'invalider les caches concernés.

### PWA

Le cache applicatif n'est plus supprimé quand la version du shell n'a pas changé. Les navigations et fichiers critiques du shell restent en network-first. Les gros modules HTML/JS/CSS précachés utilisent stale-while-revalidate : affichage du cache immédiat, actualisation réseau en arrière-plan. Le nom de cache versionné garantit l'activation atomique d'une nouvelle version.

### Instrumentation

Le mode performance, inactif par défaut, relève : durée connexion → interface utilisable, durée des `getDocs`, documents retournés, requêtes simultanées maximales, listeners ouverts/fermés et cache hit/miss des fiches. Les 250 derniers événements sont accessibles dans `window.CoachPulsePerf`.

## Avant / après vérifiable

| Scénario | Avant | Après | Gain vérifiable |
|---|---|---|---|
| Connexion → interface utilisable | Attend profil, sync cloud, puis refresh joueuses forcé | Attend uniquement profil/permissions et purge locale de sécurité | 2 opérations réseau non essentielles retirées du chemin critique ; requête joueuses avant affichage : 1 logique (1 globale ou 2 ciblées par lot) → 0 |
| Première fiche joueuse | Charge la sélection puis précharge toutes les autres joueuses | Charge uniquement la sélection | Requêtes des joueuses non consultées : jusqu'à 15 × N → 0 |
| Retour fiche joueuse | Cache mémoire existant | Inchangé, cache mémoire réutilisé | 0 nouvelle requête pendant le TTL |
| Première fiche équipe | Charge l'équipe puis deux synthèses voisines | Charge uniquement l'équipe demandée | 2 chargements spéculatifs → 0 |
| Ouverture Tests techniques | `forceRefresh` implicite | Cache pendant 5 min, refresh explicite/à échéance | Relecture lors d'un retour immédiat : 1 → 0 |
| Retour visible Tests techniques | Revalidation possible toutes les 15 s | Revalidation au plus toutes les 60 s | Fréquence maximale divisée par 4 |
| Relancement PWA même version | Purge de tous les caches CoachPulse | Cache conservé, vérification SW non bloquante | Purges systématiques : 1 → 0 |
| Retour vers module précaché | Attend le réseau pour HTML/JS/CSS | Sert le cache et revalide en arrière-plan | Attente réseau du module précaché supprimée |

`N` désigne le nombre de joueuses autres que la sélection. Les durées, documents facturés et gains en pourcentage restent « non mesurés » tant que les scénarios ne sont pas rejoués avec un compte dev et des données représentatives.

## Sécurité et cache

- Les permissions et le profil temps réel restent obligatoires avant déverrouillage.
- La purge locale est déplacée avant l'affichage, jamais supprimée.
- Le service joueuses conserve les requêtes filtrées `teamId` et `teamIds` ainsi que la clé de cache liée au périmètre autorisé.
- Les caches de fiches restent en mémoire et sont invalidés par les écritures concernées ou un changement de données/permissions.
- La déconnexion conserve le nettoyage des données sensibles existant.
- Aucun modèle Firestore, règle de sécurité ou index n'est modifié.

## Validation

- `npm run check` : OK
- `npm run test:core` : OK
- `npm run test:pwa` : OK
- `npm run audit:static` : OK
- `npm run build:public` : OK
- `git diff --check` : OK
- Navigateur desktop 1280×720 : rendu OK, pas d'erreur applicative
- Navigateur tablette 768×1024 : rendu OK, aucun débordement horizontal
- Parcours authentifiés : non exécutés, identifiants de test indisponibles

## Suite recommandée

Une PR ultérieure pourra découper la fiche individuelle par familles de données chargées à l'ouverture de chaque onglet. Cette évolution demande une validation métier plus large des synthèses et n'est pas nécessaire pour supprimer le préchargement massif identifié ici. La modularisation des fichiers HTML volumineux (`tests-techniques.html`, `presences.html`) peut également être traitée séparément ; elle n'est pas prioritaire face aux lectures réseau corrigées dans cette PR.
