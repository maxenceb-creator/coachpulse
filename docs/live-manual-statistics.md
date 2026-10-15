# Saisie manuelle pendant un Live

L’éditeur Live utilise le même snapshot `state.players`, le même journal `state.log`, les mêmes identifiants d’événements et la même persistance transactionnelle que l’éditeur Après-match. Il ne maintient pas un second total statistique.

## Règle de calcul

- Une statistique non modifiée continue de provenir du Live.
- Une cellule modifiée remplace explicitement le total correspondant ; elle n’est jamais additionnée au total Live.
- La provenance du champ devient `MANUAL` si la valeur était inconnue, sinon `CORRECTED`.
- Le match devient `statsSource: MIXED` dès qu’une correction manuelle est appliquée.
- Une valeur vide reste `null` et n’est pas convertie en zéro.
- Une modification de total ne crée aucun événement.
- Un événement ajouté manuellement porte `source: MANUAL`; un événement existant modifié conserve son `eventId` et porte `correctionSource: CORRECTED`.
- Le score n’est pas modifiable dans l’éditeur. Un écart entre buts individuels et score Live est signalé et doit être résolu explicitement dans le Live.

## Fusion et conflits

À l’ouverture, l’éditeur conserve une version de référence. À l’enregistrement, une fusion à trois versions compare cette référence, le brouillon et l’état Live courant.

Seuls les compteurs et événements réellement modifiés sont appliqués. Le chrono, la phase, la composition, les postes, les remplacements, le score et les nouveaux événements Live proviennent toujours de l’état courant. Si le Live et le brouillon ont modifié différemment le même compteur ou le même événement, l’enregistrement est refusé et le brouillon reste disponible.

La synchronisation Firestore compare ensuite la `revision` attendue dans une transaction. Une révision différente produit un conflit explicite. Les suppressions Live sont transmises par identifiant explicite avec une liste d’événements non exhaustive : un événement concurrent absent du brouillon n’est donc jamais supprimé implicitement.

## Hors ligne

Les changements validés sont immédiatement fusionnés dans l’état local et stockés avec `pendingSync`. Le retour en ligne relance une seule synchronisation du snapshot courant. L’interface ne présente pas l’écriture Firestore comme réussie avant la fin de la transaction.

## Permissions

L’ouverture est refusée lorsque les capacités centrales indiquent l’absence de droit d’écriture. La transaction réapplique les contrôles du profil, du module `stats`, du niveau `SAISIE` et du périmètre équipe. Les Firestore Rules ne sont pas modifiées.
