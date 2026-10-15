# Contrat statistique Matchs

Ce document décrit le contrat préparatoire du moteur statistique partagé. Il ne modifie ni le schéma Firestore existant ni les écritures du module Matchs.

## Champs canoniques

Compteurs individuels conservant les noms historiques :

- `but`, `passe`, `tirCadre`, `tirNonCadre`, `centre`, `progression`, `entree20`, `recup` ;
- `duelWon`, `duelLost` ;
- `seconds` pour le temps joué ;
- `positionSeconds` pour la ventilation par poste ;
- `zones` pour les ventilations spatiales.

Compteurs adverses :

- `butAdv`, `tirCadreAdv`, `tirNonCadreAdv`, `centreAdv`, `progressionAdv`, `entree20Adv` ;
- `recupAdv`, `duelWonAdv`, `duelLostAdv` ;
- `zones` pour les ventilations spatiales.

`scoreUs` et `scoreThem` restent des champs canoniques du match. Ils ne sont pas recalculés ni écrits par le service dans cette PR.

## Champs dérivés

Le service peut calculer sans modifier ses entrées :

- totaux collectifs par compteur individuel ;
- tirs totaux équipe et adversaire ;
- précision des tirs ;
- taux de conversion ;
- buts, passes décisives et buts encaissés agrégés.

Les indicateurs dérivés ne constituent pas de nouveaux champs Firestore dans cette PR.

## Absence, zéro et valeur inconnue

- Champ absent : donnée non fournie par le producteur historique.
- `null` ou chaîne vide : donnée explicitement inconnue ou non renseignée.
- `0` : valeur connue et égale à zéro.

`numberOrUnknown()` préserve cette distinction en retournant `null` pour une donnée absente/inconnue et `0` pour un zéro explicite.

La normalisation compatible avec le Live utilise par défaut zéro pour les compteurs absents. Les futurs formulaires pourront demander `unknown: "preserve"` pour conserver `null`. Aucune donnée existante n'est réécrite.

## Validation

- Les compteurs et temps connus doivent être numériques et positifs ou nuls.
- Les compteurs normalisés sont des entiers.
- Les temps par poste négatifs ou nuls sont ignorés par la normalisation.
- La somme des temps par poste ne doit pas dépasser `seconds`.
- Pour compatibilité historique, la normalisation réduit proportionnellement `positionSeconds` lorsque cette somme dépasse le temps total.
- Une joueuse est participante si elle possède un temps positif, un temps par poste positif ou un indicateur explicite `entered`, `played`, `participated` ou un statut équivalent.
- La seule présence dans `playerIds` ne prouve jamais la participation.

## Score, buts et événements

Le contrat constate trois valeurs pouvant diverger dans les données historiques :

- score stocké dans `scoreUs` / `scoreThem` ;
- somme de `players.*.but` et `opp.butAdv` ;
- événements de but présents dans `matchEvents` ou `match.log`.

Cette PR ne choisit pas arbitrairement l'une de ces valeurs et ne les réconcilie pas. Le moteur expose les agrégats pour permettre aux futurs modes de détecter les écarts. Le score stocké reste celui utilisé par les bilans de résultats existants.

## Compatibilité historique

- Les noms actuels sont conservés.
- Les alias d'identité peuvent résoudre `playerId`, les snapshots et les noms historiques.
- Les variantes de temps `playingSeconds`, `tempsSecondes` et `playedSeconds` sont lues.
- Les variantes `positions` et `positionSeconds` sont lues.
- Un `playerIds` historique surdimensionné n'est pas utilisé pour déterminer la participation.
- Les fonctions pures ne mutent jamais le match, les joueuses, les zones ou les temps reçus.

## Provenance future

Valeurs prévues mais non écrites dans cette PR :

- `entryMode`: `LIVE`, `QUICK_POST_MATCH`, `FULL_POST_MATCH` ;
- `statsSource`: `EVENTS`, `MANUAL`, `MIXED`.

Ces valeurs décriront la provenance. Elles ne modifieront pas à elles seules les règles de calcul et resteront facultatives pour tous les anciens matchs.

## Persistance versionnée préparatoire

Le service pur `match-persistence-service.js` prépare, sans les écrire, les champs suivants :

- `schemaVersion`: version du schéma ; la version préparée est `1` ;
- `revision`: entier sûr positif ou nul, incrémenté d'une unité après une modification acceptée ;
- `entryMode`: `LIVE`, `QUICK_POST_MATCH` ou `FULL_POST_MATCH` ;
- `statsSource`: `EVENTS`, `MANUAL` ou `MIXED` ;
- `status`: `DRAFT` ou `COMPLETED` ;
- `updatedAt`: horodatage de la dernière écriture, destiné à être fourni par le serveur.

Pour une lecture compatible, un ancien match sans ces champs reçoit une vue par défaut : `schemaVersion: 0`, `revision: 0`, `entryMode: LIVE`, `statsSource: EVENTS`, `status: COMPLETED` et `updatedAt: null`. Cette vue ne réécrit pas le document. L'absence de `revision` produit l'état explicite `ABSENT`; une valeur présente mais négative, fractionnaire, non numérique ou hors des entiers sûrs produit `INVALID` et doit être refusée.

La détection de conflit compare la révision attendue à la révision distante. Une égalité autorise la préparation de `revision + 1`; toute différence refuse la modification obsolète et fournit un message destiné à la future interface. Les dates clientes ne participent pas à cette décision. Aucune transaction Firestore n'est activée ici.

La réconciliation compare les événements exclusivement par `eventId` stable (avec lecture de l'alias historique `id`). Elle sépare les événements ajoutés, modifiés, supprimés et inchangés, conserve tous les champs connus ou inconnus et refuse un événement sans identifiant. Elle ne fabrique aucun événement à partir de statistiques manuelles. La suppression est choisie explicitement : `PHYSICAL` prépare une suppression de document ; `LOGICAL` prépare un tombstone `deleted: true`. Le service n'exécute aucune suppression Firestore.

Une correction future comporte le chemin du champ, l'ancienne valeur, la nouvelle valeur, l'auteur, la date, le motif, la révision initiale et la révision résultante. `targetType` distingue `STAT_TOTAL` de `EVENT`; une correction d'événement exige son `eventId`. Aucun historique n'est écrit dans cette PR.
