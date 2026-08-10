# Nettoyage structurel CoachPulse

## Objectif

Cette passe nettoie l'application sans modifier le comportement metier ni le design global.
Le but est de rendre les prochains nettoyages plus surs en detectant automatiquement les doublons locaux,
les fichiers trop volumineux, les scripts inline empiles et les artefacts generes qui ne doivent pas etre versionnes.

## Nettoyage effectue

- Suppression locale du dossier parasite `public/shared 2`.
- Renforcement de `scripts/audit-static.js` pour signaler :
  - les dossiers locaux probablement dupliques se terminant par ` 2`;
  - les fichiers source trop volumineux a decouper progressivement;
  - les pages HTML avec trop de scripts ou styles inline;
  - les artefacts generes suivis par Git;
  - une incoherence entre les scripts de deploiement et le build du dossier `public`.

## Etat actuel observe

- `app.js` reste le fichier le plus sensible : environ 6000 lignes, avec beaucoup de responsabilites.
- `pages/presences.html` et `pages/coach-stats.html` sont les pages les plus lourdes.
- Plusieurs pages contiennent encore des styles et scripts inline. Il faut les extraire progressivement,
  module par module, pour eviter les regressions.
- Le dossier `public/` est bien ignore par Git et regenere par `npm run build:public`.

## A ne pas faire en une seule PR

Une reecriture complete de `app.js` ou des gros modules HTML serait trop risquee sans tests fonctionnels plus fins.
Les modules a decouper en priorite sont :

1. Presences.
2. Matchs / Coach stats.
3. Tests techniques.
4. Methodologie / Bilans planning.
5. Accueil et shell applicatif.

## Strategie recommandee

Faire une PR par module, avec a chaque fois :

1. extraction des constantes;
2. extraction de la recuperation des donnees;
3. extraction des calculs;
4. extraction du rendu;
5. verification locale;
6. build public;
7. controle de non-regression.

Cette approche evite de casser les liens `playerId`, `teamId`, les droits utilisateurs, le cache PWA et la synchronisation Firestore.
