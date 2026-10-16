# Plan de release Production CoachPulse

## Invariants et responsabilités

- Projet Firebase partagé par DEV et PROD : `coach-pulse-ee6b0` (Firestore, Rules et Hosting). Seuls les canaux Hosting diffèrent.
- La fusion sur `main` ne déploie que Hosting. Elle ne compile ni ne publie les Rules.
- Les Rules ne peuvent être publiées que par le workflow manuel **Deploy production Firestore Rules only**, depuis `main`, avec la confirmation exacte `DEPLOY_FIRESTORE_RULES` et l'empreinte SHA-256 du ruleset actif autorisé.
- Aucun environnement GitHub protégé n'est présumé configuré. Avant la release, un administrateur doit vérifier les paramètres réels du dépôt et, si souhaité, protéger le workflow Rules par les mécanismes GitHub effectivement disponibles.
- Les données locales non synchronisées ne sont jamais supprimées par le mécanisme de mise à jour.

## Matrice de compatibilité

| Client | Rules de compatibilité | Rules strictes |
|---|---:|---:|
| Client ancien sans garde de protocole | Toléré, risque d'écriture historique | Non garanti : maintenir bloqué jusqu'à décision explicite |
| Client protocole 2 | Oui | Oui, après validation des tests et de la télémétrie disponible |
| Client futur dont le protocole est inférieur à `minimumWriteProtocol` | Écriture bloquée côté client, export/rechargement proposé | Écriture bloquée côté client |

`firestore.compat.sha256` fige l'empreinte attendue pendant la phase Hosting-only. Toute différence avec le ruleset réellement actif arrête le déploiement Hosting. Elle ne doit jamais être mise à jour pour « faire passer » un contrôle sans identification et validation du ruleset actif.

Checkpoint relevé en lecture seule le 16 octobre 2026 : ruleset actif `projects/coach-pulse-ee6b0/rulesets/a6bf473c-db20-4308-99a5-7f3ae5fde549`, SHA-256 `6a229939b02711f308c58d22928dce25a58cb87e89ebb245002d6291b2fb3d68`. La cible stricte suivie dans `firestore.rules` a alors le SHA-256 `e7f8d8d0059b4f08c69e9f71c3bc0001d9f2a0a8e74c040f36701e91743525e3`.

## Phase 1 — Validation des PR

**Entrée.** PR #242 et #243 intégrées à `dev`; branche de release basée sur le SHA `4cf07dc38de82067f0de29c02f213bc706eb3064` ou sur son descendant humainement validé.

**Actions.** Relire les diffs; exécuter `npm run test:match`, `npm run check`, `npm run build:public` et `npm run test:rules`; vérifier la syntaxe des workflows et leur séparation.

**Vérifications.** CI verte sans contournement; aucune étape PROD dans un événement `pull_request`; empreinte de compatibilité expliquée et approuvée.

**GO / NO GO.** GO uniquement si toutes les validations sont vertes et si l'empreinte active observée correspond au checkpoint de compatibilité. NO GO sur échec, secret manquant, empreinte inconnue ou divergence de Rules.

**Arrêt.** Ne pas fusionner; conserver la PR et corriger ou documenter l'écart.

## Phase 2 — Fusion de `dev` vers `main`

**Entrée.** Phase 1 GO; approbations humaines; fenêtre de release ouverte; sauvegarde des identifiants de la dernière version Hosting et du ruleset actif.

**Actions.** Créer et fusionner manuellement la PR `dev` vers `main` selon les protections réelles du dépôt.

**Vérifications.** Le SHA fusionné est celui approuvé; le workflow déclenché est **Deploy production Hosting only**; aucune exécution du workflow Rules-only.

**GO / NO GO.** GO si le SHA et l'événement `push` sur `main` sont exacts. NO GO sinon.

**Arrêt.** Annuler la release; ne pas déclencher Rules-only.

## Phase 3 — Déploiement Hosting-only

**Entrée.** Phase 2 GO; Rules actives correspondant exactement à `firestore.compat.sha256`.

**Actions.** Laisser le workflow `main` valider l'application, les tests Rules, le build et l'empreinte active, puis publier uniquement le canal Hosting `live`.

**Vérifications.** Logs sans `firebase deploy --only firestore:rules`; version Hosting active identifiée; `release.json` servi avec `writeProtocol: 2` et `minimumWriteProtocol: 2`; lecture et écriture de contrôle sur des données de test autorisées uniquement (aucune migration).

**GO / NO GO.** GO si Hosting est sain et les Rules sont restées inchangées. NO GO si l'empreinte diffère, si Hosting échoue ou si une régression fonctionnelle apparaît.

**Arrêt.** Stopper avant toute activation des Rules strictes; envisager le rollback Hosting décrit plus bas.

## Phase 4 — Transition des anciens clients

**Entrée.** Nouveau Hosting stable.

**Actions.** Demander aux utilisateurs actifs d'exporter leurs brouillons et de recharger. Le client protocole 2 contrôle `release.json` sans cache avant une écriture de match; s'il devient obsolète, il bloque l'écriture, garde les brouillons, propose leur export et un rechargement manuel. Il ne boucle pas automatiquement sur la synchronisation.

**Vérifications.** Tester un client compatible, un minimum simulé supérieur, un brouillon Live, un brouillon Après-match, un match hors ligne, un échec de synchro, une saturation du stockage et la restauration après rechargement.

**GO / NO GO.** GO lorsque les clients observables utilisés pendant la fenêtre ont été rechargés et que les sauvegardes locales critiques ont été traitées. NO GO si des équipes signalent des brouillons non exportés, des conflits ou des clients bloqués sans voie de récupération.

**Arrêt.** Maintenir les Rules de compatibilité; prolonger la fenêtre de transition.

### Clients impossibles à observer

Il est impossible de prouver que tous les onglets, tablettes ou PWA hors ligne ont reçu le nouveau code. `skipWaiting()` n'actualise pas le JavaScript déjà exécuté dans une page ouverte. Politique : annoncer une échéance, maintenir les Rules de compatibilité pendant cette période, obtenir une confirmation opérationnelle des équipes connues, et traiter tout client non observé comme ancien. Le passage aux Rules strictes est une acceptation humaine explicite de ce risque résiduel, jamais une déduction automatique.

## Phase 5 — Vérification des préconditions Rules

**Entrée.** Phase 4 GO et décision humaine d'accepter le risque des clients non observables.

**Actions.** Relever via le contrôle d'empreinte le nom du ruleset actif et son SHA-256; comparer ce SHA au checkpoint autorisé; enregistrer le ruleset précédent et la version Hosting courante; vérifier que les tests Rules couvrent le protocole attendu.

**Vérifications.** `expected_active_sha256` contient exactement 64 caractères hexadécimaux et correspond au ruleset actif; branche `main`; fichier `firestore.rules` relu; aucune modification métier non justifiée.

**GO / NO GO.** GO après double validation humaine des empreintes et de la matrice de compatibilité. NO GO sur toute ambiguïté.

**Arrêt.** Ne pas déclencher le workflow Rules-only.

## Phase 6 — Déploiement Rules-only

**Entrée.** Phase 5 GO.

**Actions.** Déclencher manuellement **Deploy production Firestore Rules only** depuis `main`; saisir `DEPLOY_FIRESTORE_RULES` et le SHA actif autorisé. Le workflow revalide l'application et les Rules, vérifie que le ruleset n'a pas changé entre-temps, publie uniquement `firestore:rules`, gère les erreurs transitoires 429/5xx avec tentatives bornées et traite un 409 uniquement par une vérification stricte.

**Vérifications.** Empreinte finale égale à celle de `firestore.rules`; aucun déploiement Hosting; nom du nouveau ruleset archivé dans le compte rendu.

**GO / NO GO.** GO si l'empreinte post-déploiement est exacte. NO GO si l'état actif initial a changé, si un 409 ne se résout pas par une empreinte exacte ou si le contrôle final échoue.

**Arrêt.** Ne pas relancer aveuglément. Identifier le ruleset actif avant toute nouvelle action.

## Phase 7 — Contrôles post-déploiement

**Entrée.** Phase 6 GO.

**Actions.** Vérifier authentification, lectures bornées par équipe, sauvegarde Live et Après-match, conflits de révision, reprise hors ligne et absence de boucle de synchronisation.

**Vérifications.** Ruleset actif exact; Hosting inchangé depuis la phase 3; aucun brouillon effacé; erreurs permissions/réseau clairement distinguées.

**GO / NO GO.** GO après contrôles fonctionnels et absence d'incident. NO GO sur refus imprévu, perte locale, écriture partielle ou anomalie d'autorisation.

**Arrêt.** Geler les écritures opérationnelles concernées et appliquer le rollback Rules seulement si sa compatibilité est confirmée.

## Phase 8 — Rollback

### Hosting uniquement

1. Identifier la version Hosting précédente et le ruleset actuellement actif.
2. Vérifier la matrice de compatibilité : ne jamais revenir vers un client qui ne sait pas écrire sous les Rules actives.
3. Si compatible, promouvoir/re-déployer uniquement la version Hosting approuvée.
4. Vérifier que l'empreinte Rules n'a pas changé et tester lecture, écriture et récupération des brouillons.

Si les Rules strictes sont déjà actives et que l'ancien Hosting ne respecte pas leur protocole, le rollback Hosting seul est **NO GO**.

### Firestore Rules uniquement

1. Retrouver le nom du ruleset précédent et son contenu source enregistré avant la phase 6.
2. Recalculer son SHA-256 et le comparer à l'empreinte archivée; toute différence est NO GO.
3. Vérifier que ce ruleset reste compatible avec le Hosting actif et n'ouvre pas de permissions métier non validées.
4. Utiliser une procédure manuelle explicitement autorisée et exclusivement Rules; ne pas modifier Hosting.
5. Relever le ruleset actif après retour arrière, vérifier son empreinte et refaire les contrôles fonctionnels.

### Déclencheurs de rollback

- refus d'écriture légitime généralisé;
- autorisation indue démontrée;
- corruption ou écriture partielle liée au protocole;
- impossibilité de récupérer les brouillons avec le client actif.

Un incident isolé non qualifié, une métrique manquante ou un simple échec transitoire ne justifie pas un rollback aveugle.

## Risques résiduels acceptables uniquement par décision humaine

- Une ancienne page déjà chargée ne reçoit pas le garde de protocole; seules les Rules peuvent finalement bloquer son écriture.
- Un client totalement hors ligne est indétectable jusqu'à sa reconnexion.
- Cache Storage peut contenir des actifs anciens jusqu'à activation du nouveau service worker; IndexedDB et localStorage sont volontairement préservés.
- La protection par reviewers d'un environnement GitHub dépend de la configuration du dépôt, non du YAML seul. Le workflow n'en revendique aucune.
