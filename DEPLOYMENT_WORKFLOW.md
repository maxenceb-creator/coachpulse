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
- `feature/...` : branche de travail pour une fonctionnalite precise
- `fix/...` : branche de correction ciblee
- `docs/...` : branche de documentation

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

## Workflow recommande en equipe

1. Partir de `dev` a jour.
2. Creer une branche `feature/...`.
3. Faire les modifications avec Codex.
4. Tester localement.
5. Commit et push de la branche de travail.
6. Ouvrir une Pull Request vers `dev`.
7. Tester le deploiement DEV.
8. Quand la version DEV est valide, fusionner `dev` vers `main`.
9. Push `main` : deploiement automatique PROD.

## Commandes type

```bash
git checkout dev
git pull origin dev
git checkout -b feature/nom-fonctionnalite

# modifications CoachPulse

npm run check
git add .
git commit -m "feat: description claire"
git push -u origin feature/nom-fonctionnalite
```

Quand la fonctionnalite est valide, ouvrir une Pull Request vers `dev`.

Quand la version DEV complete est valide :

```bash
git checkout main
git pull
git merge dev
git tag v1.2.0
git push
git push origin v1.2.0
```

## Protection des branches conseillee

Sur GitHub, configurer les protections suivantes dans `Settings > Branches` :

- `main` : Pull Request obligatoire, push direct interdit, 1 validation recommandee.
- `dev` : Pull Request recommandee, push direct reserve aux petites corrections urgentes.

Les branches `feature/...` ne doivent jamais deployer directement la production.

## Gestion des conflits

Si deux personnes modifient le meme fichier :

```bash
git checkout feature/nom-fonctionnalite
git fetch origin
git merge origin/dev
npm run check
git add .
git commit
git push
```

Si le conflit est sensible, valider ensemble avant de fusionner.

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
