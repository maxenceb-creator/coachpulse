(function(global){
  function api(){ return global.parent?.CoachPulseCentralData || {}; }
  const OFFICIAL_TEAMS = [
    {teamId:'team-u7-a', name:'U7 A', category:'U7', subCategories:['U6','U7'], source:'Aperçu local'},
    {teamId:'team-u9-a', name:'U9 A', category:'U9', subCategories:['U8','U9'], source:'Aperçu local'},
    {teamId:'team-u11-a', name:'U11 A', category:'U11', subCategories:['U10','U11'], source:'Aperçu local'},
    {teamId:'team-u13-a', name:'U13 A', category:'U13', subCategories:['U12','U13','U14'], source:'Aperçu local'},
    {teamId:'team-u13-b', name:'U13 B', category:'U13', subCategories:['U12','U13'], source:'Aperçu local'},
    {teamId:'team-u16-a', name:'U16 A', category:'U16', subCategories:['U15','U16'], source:'Aperçu local'},
    {teamId:'team-u19', name:'U19', category:'U19', subCategories:['U17','U18','U19'], source:'Aperçu local'},
    {teamId:'team-r1', name:'R1', category:'SENIORS', subCategories:['SENIORS'], source:'Aperçu local'}
  ];
  function text(value){ return String(value ?? '').trim(); }
  function seasonFromDate(date){
    if(api().seasonFromDate) return api().seasonFromDate(date);
    const d = new Date(date || Date.now());
    if(Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }
  function currentSeason(){ return api().currentSeason?.() || seasonFromDate(new Date()); }
  function teamIdOf(team){ return text(team?.teamId || team?.id); }
  function teamName(team={}){ return text(team.name || team.team || team.equipe || team.category || team.categorie || 'Équipe'); }
  function dateOf(row={}){
    return text(row.date || row.matchDate || row.startDate || row.declaredAt || row.createdAtIso || row.updatedAtIso).slice(0, 10);
  }
  function seasonOf(row={}){
    return text(row.season || row.saison || row.currentSeason) || seasonFromDate(dateOf(row));
  }
  function rowTeamIds(row={}){
    return [
      row.teamId,
      row.team_id,
      row.team?.teamId,
      row.teamSnapshot?.teamId,
      row.playerSnapshot?.teamId,
      row.sessionSnapshot?.teamId,
      row.matchSnapshot?.teamId
    ].map(text).filter(Boolean);
  }
  function rowMatchesTeam(row={}, teamId=''){ return Boolean(text(teamId) && rowTeamIds(row).includes(text(teamId))); }
  async function listTeams(){
    if(api().listTeams) return (await api().listTeams({includeArchived:false})).filter(team => !api().canAccessTeam || api().canAccessTeam(teamIdOf(team)));
    return OFFICIAL_TEAMS;
  }
  async function loadTeamData(teamId){
    if(api().teamProfileLoadData) return api().teamProfileLoadData({teamId});
    const teams = await listTeams();
    return {app:'CoachPulse', module:'teamProfile', currentSeason:currentSeason(), teamId, collections:{teams:teams.filter(team => !teamId || teamIdOf(team) === teamId), players:[], matches:[], matchEvents:[], sessions:[], attendance:[], technicalTests:[], physicalTests:[], injuries:[], workloads:[]}};
  }
  function normalizeCollections(payload={}){
    const c = payload.collections || {};
    return {
      teams:c.teams || [],
      players:c.players || [],
      matches:c.matches || [],
      matchEvents:c.matchEvents || [],
      sessions:c.sessions || [],
      attendance:c.attendance || [],
      technicalTests:c.technicalTests || [],
      physicalTests:c.physicalTests || [],
      injuries:c.injuries || [],
      injuryUpdates:c.injuryUpdates || [],
      medicalAppointments:c.medicalAppointments || [],
      rehabRoutines:c.rehabRoutines || [],
      workloads:c.workloads || [],
      convocations:c.convocations || [],
      medicalFollowUps:c.medicalFollowUps || [],
      individualReports:c.individualReports || []
    };
  }
  function playerForSeason(player={}, season=currentSeason()){ return api().playerForSeason ? api().playerForSeason(player, season) : player; }
  function displayPlayerName(player={}){
    return text(player.displayName || player.name || [player.prenom || player.firstName, player.nom || player.lastName].filter(Boolean).join(' ')).toUpperCase();
  }
  function openPlayerProfile(playerId){
    if(!playerId) return;
    try{
      localStorage.setItem('coachpulse:playerProfile:selectedPlayerId', playerId);
      global.parent?.postMessage?.({type:'coachpulse-open-module', moduleId:'playerProfile', playerId}, '*');
    }catch(_e){ /* navigation optionnelle */ }
  }
  global.TeamProfileData = {api, text, seasonFromDate, currentSeason, teamIdOf, teamName, dateOf, seasonOf, rowTeamIds, rowMatchesTeam, listTeams, loadTeamData, normalizeCollections, playerForSeason, displayPlayerName, openPlayerProfile};
})(window);
