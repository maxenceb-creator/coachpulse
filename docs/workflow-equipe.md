# Workflow equipe CoachPulse

Ce document sert de methode simple pour travailler a deux sur CoachPulse sans definir de roles fixes trop tot.

## Principe general

Pour le moment, nous ne definissons pas de roles fixes.

Chacun doit pouvoir toucher a plusieurs parties du projet afin de comprendre progressivement tout CoachPulse : interface, Firebase, modules, Data Hub, administration, PWA et deploiement.

On repartit donc les fonctionnalites, pas les metiers.

Exemples :

- une personne travaille sur `feature/blessures` ;
- l'autre travaille sur `feature/dashboard` ;
- la semaine suivante, les sujets peuvent changer.

Le plus important est d'eviter que deux personnes modifient fortement les memes fichiers au meme moment.

## Organisation par fonctionnalite

Chaque tache doit etre traitee comme une fonctionnalite independante.

Exemples de branches :

- `feature/blessures`
- `feature/presences`
- `feature/data-hub`
- `feature/dashboard`
- `feature/tests`
- `feature/bilans`

Avant de demarrer, creer une petite fiche de fonctionnalite :

```text
Fonctionnalite :
Responsable :
Objectif :
Pourquoi c'est utile :
Fichiers ou modules probablement concernes :
Critere de fin :
Tests a faire :
Risque de conflit avec :
```

## Questions avant de commencer

Avant de creer une branche, repondre a ces questions :

- Qu'est-ce qu'on veut construire ?
- Pourquoi cette fonctionnalite est utile ?
- Qui s'en occupe ?
- Quels fichiers ou modules seront probablement modifies ?
- Comment saura-t-on que c'est termine ?
- Est-ce que l'autre personne travaille deja sur les memes fichiers ?

Si deux fonctionnalites touchent les memes fichiers centraux, par exemple `app.js`, `index.html`, `sw.js` ou les services partages, se coordonner avant de commencer.

## Workflow Git

Les branches ont un role simple :

- `main` = production stable.
- `dev` = version de test commune.
- `feature/...` = une fonctionnalite isolee.

Regles :

- on cree toujours une branche depuis `dev` ;
- on ne travaille jamais directement sur `main` ;
- on fusionne d'abord dans `dev` ;
- on fusionne ensuite `dev` vers `main` seulement quand la version est validee.

Commandes pour commencer :

```bash
git checkout dev
git pull origin dev
git checkout -b feature/nom-fonctionnalite
```

Apres modification :

```bash
git add .
git commit -m "feat: description claire"
git push origin feature/nom-fonctionnalite
```

## Pull Request

Une Pull Request doit contenir :

- un titre clair ;
- une description de ce qui a ete fait ;
- les fichiers principaux modifies ;
- les tests realises ;
- les points a verifier par l'autre personne.

Flux recommande :

```text
feature/... -> dev -> main
```

Une fonctionnalite va d'abord dans `dev`. La branche `main` reste reservee a la production stable.

## Repartition temporaire

La repartition reste souple :

- une personne prend une fonctionnalite ;
- l'autre prend une autre fonctionnalite ;
- les roles peuvent changer selon les semaines ;
- les sujets sensibles sont annonces avant de commencer.

Exemple d'organisation simple :

| Semaine | Personne A | Personne B |
| --- | --- | --- |
| 1 | `feature/blessures` | `feature/dashboard` |
| 2 | `feature/presences` | `feature/data-hub` |
| 3 | `feature/tests` | `feature/bilans` |

Ce tableau n'est pas fixe. Il sert seulement a eviter que deux personnes travaillent sans le savoir sur le meme endroit.

## Revue rapide avant fusion dans dev

Avant de fusionner une branche dans `dev`, l'autre personne verifie :

- l'application demarre ;
- la fonctionnalite fonctionne ;
- il n'y a pas d'erreur visible ;
- le code ne casse pas une autre partie ;
- le design reste coherent avec CoachPulse ;
- les donnees existantes ne sont pas supprimees ;
- les droits admin/staff restent respectes si la fonctionnalite est sensible.

Verification minimale :

```bash
npm run check
```

Puis tester l'ecran concerne sur ordinateur, tablette ou vue mobile selon la fonctionnalite.

## Definition de termine

Une fonctionnalite est terminee quand :

- l'objectif annonce est atteint ;
- les criteres de fin sont valides ;
- les tests listes ont ete faits ;
- la Pull Request est comprehensible ;
- l'autre personne a pu relire ;
- la branche est fusionnee dans `dev` ;
- le deploiement DEV est vert.

Pour passer en production, il faut ensuite valider `dev` puis faire une Pull Request `dev -> main`.

## A ne pas faire

- Ne pas travailler directement sur `main`.
- Ne pas modifier les workflows GitHub Actions sans raison claire.
- Ne pas ajouter de cle privee ou fichier sensible.
- Ne pas supprimer automatiquement des donnees Firebase.
- Ne pas lancer une grosse refonte sans prevenir l'autre personne.
- Ne pas melanger plusieurs grosses fonctionnalites dans une seule branche.
