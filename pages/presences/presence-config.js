(function(){
  const DEFAULT_ATTENDANCE_CODES = [
    {id:"present", label:"Présente", short:"P", tone:"green"},
    {id:"late", label:"Retard", short:"R", tone:"gold"},
    {id:"not-convoked", label:"Non convoquée", short:"NC", tone:"gray"},
    {id:"absent", label:"Absence non justifiée", short:"ANJ", tone:"red"},
    {id:"excused", label:"Absence justifiée", short:"AJ", tone:"orange"},
    {id:"sick", label:"Malade", short:"M", tone:"gray"},
    {id:"injured", label:"Blessée", short:"B", tone:"navy"},
    {id:"pole", label:"Pôle Espoir", short:"PO", tone:"purple"},
    {id:"district", label:"District", short:"D", tone:"blue"},
    {id:"d2", label:"Entraînement groupe pro", short:"D2", tone:"dark", teamIds:["team-u19"]}
  ];

  window.CoachPulsePresencesConfig = {
    storageKeys:{
      presenceEvents:"coachpulse:presenceEvents:v1",
      presenceSettings:"coachpulse:presenceSettings:v1",
      methodologieEvents:"methodo_events_v24",
      legacyPresence:"presenceSeanceV3_6_Excel"
    },
    monthNames:["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
    fallbackTeams:[
      {teamId:"team-u7-a", name:"U7 A", category:"U7"},
      {teamId:"team-u9-a", name:"U9 A", category:"U9"},
      {teamId:"team-u11-a", name:"U11 A", category:"U11"},
      {teamId:"team-u13-a", name:"U13 A", category:"U13"},
      {teamId:"team-u13-b", name:"U13 B", category:"U13"},
      {teamId:"team-u16-a", name:"U16 A", category:"U16"},
      {teamId:"team-u19", name:"U19", category:"U19"},
      {teamId:"team-r1", name:"R1", category:"SENIORS"}
    ],
    teamColors:["#1d995b","#0f766e","#2563eb","#7c3aed","#c2410c","#be123c","#b45309","#047857"],
    attendanceCodeTones:{
      green:{bg:"#dcfce7", color:"#118048"},
      gold:{bg:"#f7e4aa", color:"#8a6500"},
      red:{bg:"#ffe1e1", color:"#dc2626"},
      orange:{bg:"#ffedd5", color:"#ea580c"},
      gray:{bg:"#e5e7eb", color:"#374151"},
      navy:{bg:"#111827", color:"#ffffff"},
      purple:{bg:"#ede9fe", color:"#6d28d9"},
      blue:{bg:"#dbeafe", color:"#2563eb"},
      dark:{bg:"#062016", color:"#f3dc8c"}
    },
    defaultAttendanceCodes:DEFAULT_ATTENDANCE_CODES,
    defaultPresenceSettings:{
      defaultTeamId:"",
      defaultType:"entrainement",
      defaultStartTime:"18:00",
      defaultEndTime:"19:30",
      defaultRecurrence:"none",
      preventionKeywords:"douleur, fatigue, blessure, reprise, gêne, gene, alerte, soin, kiné",
      attendanceCodes:DEFAULT_ATTENDANCE_CODES
    }
  };
})();
