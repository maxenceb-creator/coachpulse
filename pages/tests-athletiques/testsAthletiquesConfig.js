(function(global){
  const TESTS=[
    {key:'vma',label:'VMA',unit:'km/h',direction:'high',family:'endurance',color:'rgba(46,125,50,1)',radar:false},
    {key:'vmi',label:'VMI 30/15 IFT',unit:'km/h',direction:'high',family:'endurance',color:'rgba(0,132,61,1)'},
    {key:'illinois',label:'Illinois',unit:'s',direction:'low',family:'agilite',color:'rgba(246,168,0,1)'},
    {key:'v10s',label:'10m',unit:'s',direction:'low',family:'vitesse',color:'rgba(37,99,235,1)'},
    {key:'v10kmh',label:'10m',unit:'km/h',direction:'high',family:'vitesse',color:'rgba(47,143,203,1)',radar:false},
    {key:'v40s',label:'40m',unit:'s',direction:'low',family:'vitesse',color:'rgba(20,83,180,1)'},
    {key:'v40kmh',label:'40m',unit:'km/h',direction:'high',family:'vitesse',color:'rgba(242,194,0,1)',radar:false},
    {key:'cmj',label:'CMJ',unit:'cm',direction:'high',family:'puissance',color:'rgba(124,58,237,1)'}
  ];
  const PAGES={
    vma:{title:'VMA · km/h',keys:['vma'],color:'rgba(46,125,50,1)'},
    vmi:{title:'VMI · 30/15 IFT',keys:['vmi'],color:'rgba(0,132,61,1)'},
    illinois:{title:'Illinois · Agilité',keys:['illinois'],color:'rgba(246,168,0,1)'},
    v10:{title:'10m · Accélération',keys:['v10s','v10kmh'],color:'rgba(37,99,235,1)'},
    v40:{title:'40m · Vitesse',keys:['v40s','v40kmh'],color:'rgba(20,83,180,1)'},
    cmj:{title:'CMJ · Puissance',keys:['cmj'],color:'rgba(124,58,237,1)'}
  };
  const OBJECTIVE_KEYS=['vma','vmi','illinois','v10s','v10kmh','v40s','v40kmh','cmj'];
  const DEFAULT_OBJECTIVES={
    U7:{vma:14.5,vmi:16,illinois:22,v10s:2.7,v10kmh:13.3,v40s:8.3,v40kmh:17.4,cmj:16},
    U9:{vma:15.5,vmi:17,illinois:21,v10s:2.45,v10kmh:14.7,v40s:7.7,v40kmh:18.7,cmj:18},
    U11:{vma:17,vmi:18.5,illinois:19.5,v10s:2.2,v10kmh:16.4,v40s:7.1,v40kmh:20.3,cmj:21},
    U13:{vma:18,vmi:19.5,illinois:18.5,v10s:2.05,v10kmh:17.6,v40s:6.7,v40kmh:21.5,cmj:24},
    U16:{vma:18.5,vmi:20,illinois:17.8,v10s:1.95,v10kmh:18.5,v40s:6.4,v40kmh:22.5,cmj:27},
    U19:{vma:19,vmi:20.5,illinois:17.2,v10s:1.9,v10kmh:18.9,v40s:6.2,v40kmh:23.2,cmj:30},
    SENIORS:{vma:19.5,vmi:21,illinois:16.8,v10s:1.85,v10kmh:19.5,v40s:6,v40kmh:24,cmj:32}
  };
  const RADAR_COLORS=['rgba(0,132,61,1)','rgba(198,40,40,1)'];

  global.CoachPulseAthleticConfig={TESTS,PAGES,OBJECTIVE_KEYS,DEFAULT_OBJECTIVES,RADAR_COLORS};
  if(typeof module!=='undefined'&&module.exports)module.exports=global.CoachPulseAthleticConfig;
})(typeof window!=='undefined'?window:globalThis);
