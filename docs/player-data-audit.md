# Audit donnees joueuses

La commande `npm run audit:players -- --file export.json` controle un export JSON sans modifier Firebase.

Elle verifie notamment :

- presence et unicite des `playerId` ;
- ecart entre le `playerId` present et le `playerId` canonique attendu ;
- doublons actifs probables par identite nom + prenom + date de naissance ;
- joueuses actives tres proches par nom/prenom, pour repérer les faux doublons ;
- joueuses actives sans equipe exploitable ;
- joueuses archivees avec historiques encore lies ;
- historiques lies a un `playerId` absent ;
- historiques sans `playerId` ;
- categories, sous-categories et saisons non standard ;
- coherence simple des snapshots de saison avec les regles de categorie.
- coherence des historiques lies avec la categorie/sous-categorie de la joueuse pour la saison du document.

Formats acceptes :

- `{ "collections": { "players": [], "attendance": [], "technicalTests": [] } }`
- `{ "players": [], "attendance": [], "technicalTests": [] }`
- `[ { "playerId": "...", "nom": "...", "prenom": "..." } ]`

Options utiles :

- `--json` produit un rapport JSON exploitable en CI.
- `--strict` fait echouer la commande aussi sur les alertes, pas seulement sur les erreurs.

Lecture du rapport :

- `errors` bloque une base saine : identifiant manquant ou playerId duplique.
- `warnings` signale les corrections a verifier avant import ou fusion : categorie incoherente, historique sans playerId, archive non fusionnee, equipe absente.
- `infos` liste les cas utiles a investiguer sans bloquer, par exemple une joueuse archivee qui conserve encore un historique lie.

La commande est en lecture seule : elle ne modifie ni Firebase ni les fichiers sources.
