const assert = require('assert');
const {findingsForHtml, LARGE_INLINE_IMAGE_BYTES} = require('./check-public-personal-data.js');

assert.deepStrictEqual(findingsForHtml('<script>const DATA={players:[],cats:[],hist:[],obj:{}}</script>'), []);
assert.deepStrictEqual(findingsForHtml('<script>const PLAYER_DB=[];</script>'), []);

const fictitiousRoster = '<script>const DATA={"players":[{"nom":"EXEMPLE","dateNaissance":"2000-01-01"}]}</script>';
assert(findingsForHtml(fictitiousRoster).includes('embedded-tests-player-roster'));

const fictitiousCoachRoster = '<script>const PLAYER_DB=[{"name":"PERSONNE EXEMPLE","birth":"2000-01-01"}]</script>';
assert(findingsForHtml(fictitiousCoachRoster).includes('embedded-coach-player-roster'));

const smallIcon = `<img src="data:image/png;base64,${'a'.repeat(64)}">`;
assert(!findingsForHtml(smallIcon).includes('large-inline-image'));

const largePhoto = `<img src="data:image/jpeg;base64,${'a'.repeat(LARGE_INLINE_IMAGE_BYTES)}">`;
assert(findingsForHtml(largePhoto).includes('large-inline-image'));

console.log('Public HTML privacy checker tests passed.');
