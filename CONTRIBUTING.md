# Contribuer a CoachPulse

Ce document explique comment travailler a deux sur CoachPulse sans casser la production.

## Regles de base

- Ne jamais coder directement sur `main`.
- Toujours partir de `dev`.
- Creer une branche par fonctionnalite.
- Tester avant de demander une validation.
- Fusionner une fonctionnalite dans `dev` avant de toucher a `main`.
- Garder des commits courts et lisibles.

## Methode sans roles fixes

Pour le moment, les roles ne sont pas figes. Chaque personne peut travailler sur plusieurs parties du projet afin de comprendre progressivement CoachPulse dans son ensemble.

On repartit le travail par fonctionnalite :

- une fonctionnalite = une branche ;
- une branche = un objectif clair ;
- une Pull Request = une validation par l'autre personne.

Avant de commencer une fonctionnalite, verifier le document : [docs/workflow-equipe.md](docs/workflow-equipe.md).

## Branches

| Branche | Role |
| --- | --- |
| `main` | Production stable |
| `dev` | Version testable |
| `feature/...` | Nouvelle fonctionnalite |
| `fix/...` | Correction ciblee |
| `docs/...` | Documentation |
| `chore/...` | Organisation, configuration, maintenance |

## Avant de commencer une fonctionnalite

Repondre rapidement a ces questions :

- Qu'est-ce qu'on veut construire ?
- Pourquoi cette fonctionnalite est utile ?
- Qui s'en occupe ?
- Quels fichiers ou modules seront probablement modifies ?
- Comment saura-t-on que c'est termine ?
- Est-ce que l'autre personne travaille deja sur les memes fichiers ?

## Demarrer une fonctionnalite

```bash
git checkout dev
git pull origin dev
git checkout -b feature/nom-fonctionnalite
```

## Sauvegarder son travail

```bash
git status
npm run check
git add .
git commit -m "feat: ajouter le module blessures"
git push -u origin feature/nom-fonctionnalite
```

## Messages de commit

Format recommande :

```text
type: action courte
```

Types utiles :

- `feat:` nouvelle fonctionnalite
- `fix:` correction
- `docs:` documentation
- `style:` visuel ou mise en forme
- `refactor:` nettoyage sans changement fonctionnel
- `chore:` configuration ou organisation

Exemples :

```text
feat: ajouter le suivi medical
fix: corriger le menu desktop
docs: expliquer le workflow equipe
```

## Pull Request

Une Pull Request doit expliquer :

- ce qui a ete modifie ;
- le module concerne ;
- comment cela a ete teste ;
- les risques eventuels ;
- les captures si le visuel change.

Flux recommande :

```text
feature/... -> dev -> main
```

## Resoudre un conflit simplement

Avant de demander de l'aide, remettre sa branche a jour avec `dev` :

```bash
git checkout feature/nom-fonctionnalite
git fetch origin
git merge origin/dev
```

Si Git indique un conflit :

1. Ouvrir les fichiers marques en conflit.
2. Garder la bonne version du code.
3. Relancer les tests.
4. Enregistrer la resolution.

```bash
npm run check
git add .
git commit
git push
```

## Donnees sensibles

Ne jamais ajouter au depot :

- fichier `.env` ;
- cle privee ;
- compte de service Firebase ;
- dossier `node_modules/` ;
- dossier `.firebase/`.

Les fichiers Firebase publics du projet restent versionnes :

- `firebase.json`
- `.firebaserc`
- `firestore.rules` si present
- `firestore.indexes.json` si present
