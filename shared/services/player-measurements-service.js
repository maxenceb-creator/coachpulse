// CoachPulse player physical measurements service.
(function(global){
  const COLLECTION = 'playerMeasurements';
  const HEIGHT_MIN_CM = 80, HEIGHT_MAX_CM = 230, WEIGHT_MIN_KG = 15, WEIGHT_MAX_KG = 200;
  const text = value => String(value ?? '').trim();
  function number(value){ return Number(typeof value === 'string' ? value.replace(',', '.').trim() : value); }
  function dateOnly(value){const raw=text(value).slice(0,10),match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return'';const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));return date.getUTCFullYear()===Number(match[1])&&date.getUTCMonth()===Number(match[2])-1&&date.getUTCDate()===Number(match[3])?raw:'';}
  function seasonFromDate(value){ const date=new Date(`${dateOnly(value)}T12:00:00Z`);if(Number.isNaN(date.getTime()))return'';const year=date.getUTCFullYear();return date.getUTCMonth()>=6?`${year}-${year+1}`:`${year-1}-${year}`; }
  function measurementId(playerId, measuredAt){ return `measurement-${text(playerId).replace(/[^a-zA-Z0-9_-]+/g,'-')}-${dateOnly(measuredAt)}`; }
  function validate(input={}){
    const playerId=text(input.playerId),teamId=text(input.teamId),measuredAt=dateOnly(input.measuredAt||input.date),heightCm=number(input.heightCm),weightKg=number(input.weightKg),errors={};
    if(!playerId)errors.playerId='La joueuse est obligatoire.';
    if(!teamId)errors.teamId='L’équipe de la joueuse est obligatoire.';
    if(!measuredAt)errors.measuredAt='La date de mesure est obligatoire.';
    if(!Number.isFinite(heightCm)||heightCm<HEIGHT_MIN_CM||heightCm>HEIGHT_MAX_CM)errors.heightCm=`La taille doit être comprise entre ${HEIGHT_MIN_CM} et ${HEIGHT_MAX_CM} cm.`;
    if(!Number.isFinite(weightKg)||weightKg<WEIGHT_MIN_KG||weightKg>WEIGHT_MAX_KG)errors.weightKg=`Le poids doit être compris entre ${WEIGHT_MIN_KG} et ${WEIGHT_MAX_KG} kg.`;
    return {success:!Object.keys(errors).length,errors,data:{playerId,teamId,teamIds:[...new Set([teamId,...(Array.isArray(input.teamIds)?input.teamIds.map(text):[])].filter(Boolean))],measuredAt,heightCm:Number(heightCm.toFixed(1)),weightKg:Number(weightKg.toFixed(1)),season:text(input.season)||seasonFromDate(measuredAt)}};
  }
  function parse(input={}){const result=validate(input);if(result.success)return result.data;const error=new Error(Object.values(result.errors)[0]||'Mesure invalide.');error.name='PlayerMeasurementValidationError';error.fields=result.errors;throw error;}
  function sortLatest(rows=[]){return rows.slice().sort((a,b)=>text(b.measuredAt||b.date).localeCompare(text(a.measuredAt||a.date))||text(b.updatedAtIso).localeCompare(text(a.updatedAtIso)));}
  const latest=rows=>sortLatest(rows)[0]||null;
  const api=()=>global.parent?.CoachPulseCentralData||global.CoachPulseCentralData||{};
  async function list(playerId,options={}){return api().playerMeasurementsList?.(text(playerId),options)||[];}
  const add=input=>api().playerMeasurementsAdd(parse(input));
  const update=(id,input)=>api().playerMeasurementsUpdate(text(id),parse(input));
  const remove=id=>api().playerMeasurementsDelete(text(id));
  const getLatest=async(playerId,options={})=>latest(await list(playerId,options));
  const capabilities=()=>api().playerMeasurementsCapabilities?.()||{canRead:false,canWrite:false,canDelete:false};
  const service={COLLECTION,HEIGHT_MIN_CM,HEIGHT_MAX_CM,WEIGHT_MIN_KG,WEIGHT_MAX_KG,validate,parse,sortLatest,latest,seasonFromDate,measurementId,list,add,update,remove,getLatest,capabilities};
  global.CoachPulsePlayerMeasurementsService=service;
  if(typeof module!=='undefined'&&module.exports)module.exports=service;
})(typeof window!=='undefined'?window:globalThis);
