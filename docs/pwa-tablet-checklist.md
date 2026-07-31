# Checklist PWA tablette CoachPulse

Cette checklist accompagne les PR qui touchent au service worker, au cache, au shell applicatif ou au comportement tablette.

## Controle automatique

Avant ouverture de PR :

```bash
npm run check
npm run audit:static
npm run build:public
```

Le controle `npm run check` execute aussi `npm run test:pwa`, qui verifie :

- existence de tous les assets precaches par `sw.js` ;
- presence des modules critiques fiche joueuse, fiche equipe, presences et services partages ;
- strategie `network-first` pour `index.html`, `app.js`, `responsive.css` et les navigations ;
- activation immediate du nouveau service worker avec `skipWaiting()` et `clients.claim()` ;
- nettoyage des anciens caches PWA.

## Controle manuel tablette

Sur iPad ou tablette Android :

1. Ouvrir le lien de preview de PR dans un onglet normal.
2. Se connecter avec un compte staff.
3. Verifier que l'application reste ouverte apres connexion.
4. Ouvrir successivement Accueil, Presences, Fiche joueuse, Fiche equipe, Tests et Joueuses & base.
5. Fermer l'onglet, rouvrir le meme lien, puis verifier que la nouvelle version s'affiche sans rester bloquee sur une ancienne UI.
6. Couper Internet apres chargement, naviguer entre deux modules deja ouverts, puis retablir Internet.
7. Relancer la synchronisation si un badge pending apparait.

## Signaux d'alerte

- retour immediat a la page de connexion apres authentification ;
- message navigateur `The quota has been exceeded` ;
- ancienne interface visible apres merge ou redeploiement ;
- module vide alors que les donnees existent apres synchronisation ;
- tablette bloquee alors que PC et iPhone fonctionnent.

Dans ces cas, commencer par tester en navigation privee, puis vider le cache du site. Si le probleme persiste sur une seule tablette malgre plusieurs navigateurs, verifier le service worker et les quotas Firebase/Auth.
