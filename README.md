# CoachPulse

CoachPulse est la plateforme staff ASSE pour centraliser les donnees sportives : matchs, presences, joueuses, tests, bilans, Data Hub, administration et modules futurs.

## Liens

- Production : https://coach-pulse-ee6b0.web.app
- Production alternative Firebase : https://coach-pulse-ee6b0.firebaseapp.com
- Depot GitHub : https://github.com/maxenceb-creator/coachpulse

## Branches

- `main` : production stable uniquement.
- `dev` : version de developpement testable.
- `feature/nom-fonctionnalite` : une branche par evolution.

Exemples :

- `feature/blessures`
- `feature/data-hub`
- `feature/presences`
- `fix/cache-pwa`
- `docs/workflow-equipe`

## Workflow simple

1. Recuperer la derniere version de `dev`.
2. Creer une branche `feature/...` depuis `dev`.
3. Faire les modifications.
4. Tester localement.
5. Pousser la branche sur GitHub.
6. Ouvrir une Pull Request vers `dev`.
7. Tester la version DEV.
8. Quand tout est valide, fusionner `dev` vers `main` pour deployer la production.

## Commandes utiles

Se placer sur la branche de developpement :

```bash
git checkout dev
git pull origin dev
```

Creer une branche de travail :

```bash
git checkout -b feature/nom-fonctionnalite
```

Enregistrer une modification :

```bash
git status
git add .
git commit -m "feat: description courte"
git push -u origin feature/nom-fonctionnalite
```

Verifier l'application :

```bash
npm run check
```

## Structure cible

```text
assets/        Images, logos, icones et ressources visuelles
css/           Styles globaux
js/            Scripts generaux quand ils seront separes
shared/        Services, composants et utilitaires communs
modules/       Modules metier independants
.github/       Automatisations GitHub Actions
```

## Deploiement

- Un push sur `dev` declenche le deploiement DEV.
- Un push sur `main` declenche le deploiement PROD.
- Les branches `feature/...` servent au travail et a la validation, pas a la production.

## Regle importante

Ne jamais travailler directement sur `main`. La production doit rester stable pour le staff.
