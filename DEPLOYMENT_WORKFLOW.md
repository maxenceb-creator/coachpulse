# Workflow CoachPulse DEV / PROD

## Objectif

CoachPulse doit rester stable en production tout en permettant de tester les nouvelles evolutions sur une branche separee.

## Environnements actuels

- PROD : Firebase project `coach-pulse-ee6b0`, site actuel `https://coach-pulse-ee6b0.web.app`
- DEV : canal Firebase Hosting preview `dev` dans le meme projet, declenche par la branche Git `dev`

Cette premiere etape evite de toucher a la production existante. Plus tard, si besoin, on pourra creer deux projets Firebase separes :

- `coachpulse-dev`
- `coachpulse-prod`

## Branches Git

- `main` : version stable, deployee automatiquement en PROD
- `dev` : version de test, deployee automatiquement sur le canal DEV

## Commandes principales

Verifier l'application localement :

```bash
npm run check
```

Deployer manuellement en DEV :

```bash
npm run deploy:dev
```

Deployer manuellement en PROD :

```bash
npm run deploy:prod
```

## Workflow recommande

1. Partir de `main` a jour.
2. Creer ou passer sur `dev`.
3. Faire les modifications avec Codex.
4. Tester.
5. Commit sur `dev`.
6. Push sur GitHub : deploiement automatique DEV.
7. Si valide, fusionner `dev` vers `main`.
8. Push `main` : deploiement automatique PROD.

## Commandes type

```bash
git checkout main
git pull
git checkout -B dev

# modifications CoachPulse

npm run check
git add .
git commit -m "Description claire"
git push -u origin dev
```

Quand la version DEV est valide :

```bash
git checkout main
git pull
git merge dev
git tag v1.1.0
git push
git push origin v1.1.0
```

## Retour arriere

Voir les versions :

```bash
git log --oneline
git tag
```

Annuler un commit casse :

```bash
git revert ID_DU_COMMIT
git push
```

Revenir temporairement a un tag stable :

```bash
git checkout v1.0.0
```

Pour remettre PROD proprement sur une ancienne version, privilegier `git revert` puis `git push`.

## Regles de securite

Ne jamais committer :

- `.env`
- `.env.local`
- `.firebase/`
- `node_modules/`
- fichiers de cle privee ou service account JSON

Garder dans Git :

- `firebase.json`
- `.firebaserc`
- `firestore.rules` si present
- `firestore.indexes.json` si present
