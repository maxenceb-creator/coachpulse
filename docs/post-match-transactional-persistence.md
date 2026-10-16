# Persistance transactionnelle Après-match

Le service `post-match-transactional-persistence-service.js` est réservé aux futurs modes `QUICK_POST_MATCH` et `FULL_POST_MATCH`. Il n'est chargé par aucune page et ne modifie pas le parcours Live.

## Transaction et conflits

Une transaction lit d'abord le document `matches/{matchId}` puis la requête exhaustive `matchEvents where matchId == matchId and teamId == teamId`. Le filtre équipe est obligatoire afin que les éducateurs non-admin satisfassent les Rules existantes. Elle compare exclusivement la `revision` distante à `expectedRevision`; `updatedAt` ne participe jamais à l'arbitrage. Une égalité produit atomiquement `revision + 1`. Une différence ou une révision invalide renvoie un refus structuré sans écriture.

Le snapshot match, les ajouts/modifications d'événements et les suppressions sont ensuite écrits dans la même transaction. Une erreur ou un retry conflictuel ne laisse donc aucune écriture partielle. Les champs historiques du match sont préservés grâce à une écriture avec fusion. Les statistiques joueuses/adverses sont normalisées par le service partagé de la PR #231.

## Suppressions

La comparaison délègue à `reconcileEvents()` de la PR #232. Une absence dans `nextEvents` n'est une suppression que si `nextEventsComplete === true`. `PHYSICAL` supprime le document; `LOGICAL` écrit le tombstone `deleted: true`. Une liste partielle, même vide, ne supprime rien. Les totaux manuels ne produisent jamais d'événements.

## Bornes et refus explicites

- maximum conservateur de 500 écritures pour l'opération entière, match inclus ;
- maximum conservateur de 1 000 000 octets par document avant envoi ;
- toutes les lectures transactionnelles précèdent toutes les écritures ;
- les événements doivent avoir un identifiant stable et unique ;
- l'opération entière est refusée si une borne est dépassée.

Firestore impose également une limite de requête de 10 MiB et des délais propres aux transactions. Ces erreurs sont renvoyées sous forme structurée par le service, sans fallback non atomique. Le service ne fragmente jamais une opération en plusieurs commits.

## Autorisations et Rules

Avant tout accès Firestore, le service vérifie via `permissions-service.js` : profil actif, droit d'écriture du module `stats`, niveau minimal `SAISIE` et accès à au moins une équipe du match. Les Rules existantes refont autorité sur chaque document `matches` et `matchEvents`; elles ne sont ni contournées ni élargies.

Aucune modification de `firestore.rules` n'est nécessaire. Pour un profil non-admin, chaque match et événement écrit doit conserver un scope équipe autorisé. Le service exige le `teamId` canonique du snapshot match et l'impose à chaque événement de la transaction.
