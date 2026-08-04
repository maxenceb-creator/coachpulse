# Audit donnees joueuses

La commande `npm run audit:players -- --file export.json` controle un export JSON sans modifier Firebase.

Elle verifie notamment :

- presence et unicite des `playerId` ;
- doublons actifs probables par identite nom + prenom + date de naissance ;
- joueuses archivees avec historiques encore lies ;
- historiques lies a un `playerId` absent ;
- coherence simple des snapshots de saison avec les regles de categorie.

Formats acceptes :

- `{ "collections": { "players": [], "attendance": [], "technicalTests": [] } }`
- `{ "players": [], "attendance": [], "technicalTests": [] }`
- `[ { "playerId": "...", "nom": "...", "prenom": "..." } ]`

Options utiles :

- `--json` produit un rapport JSON exploitable en CI.
- `--strict` fait echouer la commande aussi sur les alertes, pas seulement sur les erreurs.
