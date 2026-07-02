# Etape 2 - Contrats de modules

Cette etape prepare CoachPulse a devenir une application modulaire sans deplacer les fichiers actifs.

## Ce qui a ete ajoute

- Un `module.json` dans chaque dossier `modules/*`.
- Des README dans `shared/components`, `shared/services`, `shared/utils`, `shared/ui`.
- Une documentation du contrat module dans `MODULE_ARCHITECTURE.md`.

## Pourquoi

Aujourd'hui, plusieurs modules existent encore sous forme de pages historiques dans `pages/`. Les manifestes permettent de savoir :

- quelle collection Firestore appartient a quel module ;
- quels roles peuvent lire/ecrire ;
- quelle page actuelle sert de fallback ;
- quelle future entree modulaire sera creee plus tard.

## Regle de securite

Aucun module actif n'a ete deplace.
Aucun comportement utilisateur n'a ete modifie.
La production reste protegee sur `main`.

## Prochaine etape recommandee

Creer un petit chargeur de configuration qui lit ces manifestes ou une copie consolidee, puis commencer par extraire le service `players`, car toutes les futures briques dependront de la base joueuses commune.
