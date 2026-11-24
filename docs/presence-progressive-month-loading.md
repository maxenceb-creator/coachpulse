# Chargement progressif des séances par mois

## Activation et retour arrière

Le module Présences utilise le chargement mensuel par défaut. Il revient automatiquement au chargement historique si Firestore renvoie `failed-precondition` (index absent ou en construction).

Le retour arrière manuel est disponible sans redéploiement :

```js
localStorage.setItem('coachpulse:presenceProgressiveMonths', '0')
```

Supprimer la clé, ou lui donner une autre valeur, réactive le chargement progressif au prochain rechargement.

## Flux

- Le premier rendu lit immédiatement le cache local existant.
- Le mois visible est ensuite actualisé avec des requêtes `sessions` bornées par `date >= YYYY-MM-01` et `date < mois suivant`.
- M-1 et M+1 sont préchargés avec `requestIdleCallback` (ou une tâche différée).
- Chaque mois n'est marqué complet qu'après le succès de toutes ses requêtes. Les promesses identiques sont dédupliquées et les réponses de navigation obsolètes ne déclenchent pas de rendu.
- Un seul groupe de listeners, limité au mois visible, remplace les listeners globaux du module.
- La collection `attendance` n'est plus lue pendant le chargement mensuel. Le détail est demandé par `sessionId` lors de l'ouverture d'une feuille.
- Les vues Bilans et Prévention déclenchent explicitement l'ancien chargement complet afin de conserver l'historique.

Les contrôles de périmètre restent identiques : ADMIN interroge le périmètre global, les autres comptes ajoutent `teamId in` et `teamIds array-contains-any`, puis appliquent de nouveau le filtrage applicatif avant le rendu. Les alias sont dédupliqués par `sessionId`.

## Index requis avant activation

Les six index `sessions` ajoutés à `firestore.indexes.json` couvrent :

- `createdFromPresenceModule + date` et `source + date` pour ADMIN ;
- les mêmes discriminants avec `teamId + date` pour le périmètre direct ;
- les mêmes discriminants avec `teamIds (array) + date` pour les alias.

Deux index `attendance` supplémentaires couvrent le détail ENTRAÎNEUR borné par `sessionId + teamId` et `sessionId + teamIds (array)`.

Déployer et attendre l'état **Enabled** de ces index avant d'autoriser la voie progressive dans un environnement. Aucun changement de Firestore Rules n'est requis.

Vérification du 7 novembre 2026 : `firebase firestore:indexes --project coach-pulse-ee6b0` a retourné une liste d'index composites vide. Les index de cette PR ne sont donc pas actifs sur ce projet. Aucun déploiement d'index n'a été effectué dans le cadre de la PR ; le mécanisme automatique conserve le chargement historique tant que Firestore renvoie `failed-precondition`.

## Requêtes attendues

Avant, un chargement ENTRAÎNEUR exécutait quatre lectures non bornées de séances par paquet d'équipes, puis deux lectures non bornées de présences par paquet (mesure réelle : 6 requêtes, 1 730 documents de présence), avec plusieurs listeners globaux.

Après, pour un paquet d'équipes, le mois visible exécute quatre lectures de séances bornées et aucune lecture `attendance`. Chaque mois adjacent exécute les mêmes lectures en arrière-plan. L'ouverture d'une feuille ajoute une lecture `attendance` bornée à un seul `sessionId` (plus le scope équipe pour ENTRAÎNEUR). ADMIN exécute deux lectures mensuelles de séances. Les bilans complets conservent volontairement le flux historique à la demande.
