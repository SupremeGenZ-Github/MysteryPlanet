export const REGIONS=[
 {key:'world',label:'World',box:[0,0,1200,600]},
 {key:'africa',label:'Africa',box:[535,165,280,340]},
 {key:'europe',label:'Europe',box:[490,25,340,220]},
 {key:'asia',label:'Asia',box:[760,0,440,355]},
 {key:'north-america',label:'North America',box:[0,0,455,310]},
 {key:'south-america',label:'South America',box:[305,245,235,265]},
 {key:'oceania',label:'Oceania',box:[920,235,400,270]},
 {key:'antarctica',label:'Antarctica',box:[0,490,1200,110]}
];
export const toMap=([lon,lat])=>[(lon+180)/360*1200,(90-lat)/180*600];
export function fromMap([x,y]){return [((x/1200*360-180+540)%360)-180,Math.max(-89.99,Math.min(89.99,90-y/600*180))]}
