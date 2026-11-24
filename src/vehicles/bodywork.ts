import { Batch, bead, box, oval, skin, type Point } from './geometry';
import { sportsExterior, wrapBumpers } from './exterior';
import type { VehicleSpec } from './specs';

export interface Shell {
  paint: Batch;
  glass: Batch;
  trim: Batch;
  tail: Batch;
  head: Batch;
  left: Batch;
  right: Batch;
}

export const newShell = (): Shell => ({
  paint: new Batch(), glass: new Batch(), trim: new Batch(), tail: new Batch(),
  head: new Batch(), left: new Batch(), right: new Batch(),
});

// Distance from the nose, half-width, deck height and shoulder height.
type Station = [number, number, number, number];
const coupeBody: Station[] = [
  [0, .805, .391, .381], [.022, .87, .432, .415], [.055, .931, .455, .471],
  [.12, .976, .483, .522], [.205, 1, .514, .568], [.292, .977, .559, .567],
  [.36, .953, .589, .571], [.48, .936, .591, .56], [.59, .951, .573, .562],
  [.69, .984, .559, .581], [.79, 1, .547, .598], [.886, .988, .549, .574],
  [.945, .964, .549, .543], [.98, .924, .531, .522], [1, .839, .502, .49],
];
const saloonBody: Station[] = [
  [0, .855, .451, .44], [.025, .923, .507, .491], [.08, .969, .531, .536],
  [.19, .993, .547, .557], [.31, .978, .585, .563], [.50, .973, .586, .56],
  [.72, .993, .573, .569], [.86, .992, .557, .562], [.96, .977, .553, .553], [1, .895, .51, .487],
];
const vanBody: Station[] = [
  [0, .853, .374, .367], [.035, .958, .405, .394], [.18, .996, .471, .46],
  [.32, 1, .478, .467], [.92, 1, .478, .467], [.987, .978, .478, .467], [1, .938, .465, .452],
];

function interpolate(profile: Station[], t: number): Station {
  let i = 1;
  while (i < profile.length - 1 && profile[i][0] < t) i++;
  const a = profile[i - 1], b = profile[i], p = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
  return [t, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p, a[3] + (b[3] - a[3]) * p];
}

const baseProfile = (s: VehicleSpec):Station[] => {
  if(s.body!=='coupe')return s.body==='van'?vanBody:saloonBody;
  const design=s.design;
  return coupeBody.map(([t,w,deck,belt])=>{
    const nose=Math.max(0,1-t*2.7),tail=Math.max(0,(t-.68)/.32),waist=Math.sin(t*Math.PI)**4;
    if(design==='muscle')return [t,Math.min(1,w+.095*(nose+tail)),deck+.07*nose+.046*tail,belt+.033];
    if(design==='exotic'||design==='midengine')return [t,w-.058*nose-.018*waist,deck-.105*nose+.061*tail,belt-.045*nose+.055*tail];
    if(design==='kaido')return [t,Math.min(1,w+.04*nose),deck+.056*nose+.09*tail,belt+.055*tail];
    if(design==='grand')return [t,w-.075*nose,deck+.035*nose-.05*tail,belt-.05*tail];
    if(design==='sport')return [t,w-.045*nose-.035*waist,deck-.045*nose+.022*tail,belt-.028*waist];
    return [t,w,deck,belt];
  });
};

function sectionAt(s:VehicleSpec,profile:Station[],t:number,simple:boolean):Point[] {
  const [, w, deck, belt] = interpolate(profile,t), archRadius=s.wheelRadius+.037;
  const z=(t-.5)*s.length,dz=Math.abs(Math.abs(z)-s.wheelbase/2),wide=s.width*.5*w;
  const clearance=s.body==='suv'?.235:.145;
  const arch=!simple&&dz<archRadius?s.wheelRadius+.006+Math.sqrt(archRadius*archRadius-dz*dz):clearance;
  const flare=Math.exp(-Math.pow(dz/(archRadius*1.44),4));
  const side=Math.max(belt*s.height+.027*flare,arch+.030),crown=Math.max((belt+.029)*s.height,side+.017);
  const waist=arch+(side-arch)*.56,undercut=.030*Math.exp(-Math.pow(z/(s.wheelbase*.32),4));
  const bands=[[0,clearance],[.65,clearance],[.83,clearance+.007],[.936,arch],[.969,arch+.020],
    [.972+.018*flare-undercut,waist],[.997,Math.max(waist+.007,side-.043)],[.975,side],
    [.862,crown],[.69,crown*.54+deck*s.height*.46],[.43,deck*s.height+.01],[0,deck*s.height]];
  return bands.map(([x,y]):Point=>[x*wide,y,z]);
}

function addLowerShell(out: Shell, s: VehicleSpec, simple: boolean) {
  const profile = baseProfile(s), archRadius = s.wheelRadius + .037;
  const sections = new Set(profile.map(p => p[0]));
  if (!simple) {
    for (const direction of [-1, 1]) {
      const axle = direction * s.wheelbase / 2;
      for (const fraction of [-1.035, -1, -.965, -.86, -.65, -.38, 0, .38, .65, .86, .965, 1, 1.035]) {
        sections.add(.5 + (axle + archRadius * fraction) / s.length);
      }
    }
  }
  const stations=[...sections].sort((a,b)=>a-b);
  const rings = stations.map(t => {
    const section=sectionAt(s,profile,t,simple);
    const left = section.map(([x,y,z]):Point=>[-x,y,z]);
    const right = section.slice(1,-1).reverse();
    return left.concat(right);
  });
  const shift=s.design==='grand'?.10:s.design==='midengine'||s.design==='exotic'?-.06:0;
  skin(rings.length,rings[0].length,(row,col)=>rings[row][col],(row,col)=>{
    const t=(stations[row]+stations[row+1])*.5;
    const within=s.body==='coupe'?t>.37+shift&&t<.731+shift:t>.32&&t<(s.body==='sedan'?.72:.80);
    return !simple&&within&&col>=9&&col<=12?undefined:out.paint;
  },true);
  for (const end of [0, rings.length - 1]) {
    const ring = rings[end];
    const center: Point = [0, (ring[0][1] + ring[Math.floor(ring.length / 2)][1]) / 2, ring[0][2]];
    const lerp=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const start=end===0?a:b,finish=end===0?b:a,steps=simple?2:5;
      for(let j=0;j<steps;j++){
        const inner=j/steps,outer=(j+1)/steps,p=lerp(center,start,inner),q=lerp(center,finish,inner),r=lerp(center,start,outer),v=lerp(center,finish,outer);
        out.paint.triangle(p,r,v);if(j)out.paint.triangle(p,v,q);
      }
    }
  }
}

// Cabin stations run from the cowl to the rear deck. Each roof has a crown and tapered pillars.
const coupeRoof: Station[] = [
  [.266, .77, .68, .532], [.312, .821, .697, .622], [.348, .845, .708, .728],
  [.437, .847, .697, .947], [.456, .844, .685, .978], [.505, .841, .68, 1],
  [.531, .839, .678, 1], [.598, .833, .676, .97], [.622, .824, .665, .946],
  [.702, .794, .65, .849], [.796, .750, .624, .666], [.825, .72, .612, .602], [.86, .67, .58, .545],
];
const sedanRoof: Station[] = [
  [.218, .804, .73, .549], [.255, .853, .742, .623], [.307, .87, .743, .746], [.389, .87, .728, .946],
  [.412, .871, .735, .982], [.504, .868, .743, 1], [.536, .866, .744, 1],
  [.638, .852, .732, .977], [.656, .849, .724, .951], [.733, .833, .712, .777],
  [.785, .803, .71, .631], [.822, .736, .684, .568],
];
const estateRoof: Station[] = [
  [.193, .81, .746, .553], [.248, .87, .768, .687], [.330, .897, .768, .926], [.359, .895, .767, .978],
  [.414, .897, .768, .994], [.493, .898, .772, 1], [.515, .897, .771, 1],
  [.660, .896, .771, .998], [.685, .894, .77, .996], [.832, .889, .769, .983],
  [.863, .878, .752, .966], [.907, .863, .746, .834], [.957, .831, .742, .607], [.969, .803, .73, .553],
];
const vanRoof: Station[] = [
  [.069, .844, .76, .415], [.116, .913, .808, .545], [.223, .935, .822, .865],
  [.267, .936, .845, .957], [.311, .936, .852, .991], [.432, .939, .854, 1], [.452, .939, .854, 1],
  [.745, .939, .852, 1], [.942, .935, .846, .995], [.968, .926, .836, .972], [.988, .917, .841, .649],
  [.995, .899, .844, .461],
];

function addCabin(out: Shell, s: VehicleSpec, simple:boolean) {
  const coupe = s.body === 'coupe', sedan = s.body === 'sedan', van = s.body === 'van';
  let roof = coupe ? coupeRoof : sedan ? sedanRoof : van ? vanRoof : estateRoof;
  if(s.design==='pickup'||s.design==='freight')roof=vanRoof.map(([t,w,r,h])=>[.04+t*(s.design==='freight'?.33:.52),w,r,h]);
  if(coupe&&s.design!=='fastback'){
    const offset=s.design==='grand'?.116:s.design==='muscle'?.034:s.design==='exotic'?-.079:s.design==='midengine'?-.092:s.design==='sport'?.043:.015;
    const stretch=s.design==='muscle'?.85:s.design==='exotic'?.83:s.design==='touring'?1.06:.95;
    roof=coupeRoof.map(([t,w,r,h])=>[.52+(t-.52)*stretch+offset,w,r*(s.design==='muscle'?1.13:s.design==='exotic'?.87:1),h]);
  }
  const profile = baseProfile(s), half = s.width / 2;
  const data = roof.map(([t, width, roofWidth, top]) => {
    const deck = interpolate(profile, t)[2] * s.height;
    const crown = Math.min((coupe ? .049 : .026) * s.height, Math.max(.002, (top * s.height - deck) * .27));
    return { t, bottom: deck - .016, top: top * s.height, width: width * half, roofWidth: roofWidth * half, crown };
  });
  const topCuts = [-1, -.916, -.82, -.56, 0, .56, .82, .916, 1];
  const windscreen = coupe ? [.312, .437] : sedan ? [.255, .389] : van ? [.116, .223] : [.248, .330];
  const backlight = coupe ? [.622, .796] : sedan ? [.656, .785] : van ? [.968, .988] : [.863, .957];
  skin(data.length, topCuts.length, (row, col) => {
    const d = data[row], x = topCuts[col];
    return [d.roofWidth * x, d.top - d.crown * x * x, (d.t - .5) * s.length];
  }, (row, col) => {
    const t = coupe ? (coupeRoof[row][0]+coupeRoof[row+1][0])/2 : (data[row].t + data[row + 1].t) / 2;
    const pane = (t > windscreen[0] && t < windscreen[1]) || (t > backlight[0] && t < backlight[1]);
    return pane && col > 0 && col < topCuts.length - 2 ? out.glass : out.paint;
  });
  const sideCuts = [0, .12, .17, .88, .945, 1];
  for (const side of [-1, 1]) {
    skin(data.length, sideCuts.length, (row, col) => {
      const d = data[row], h = sideCuts[col];
      const width = d.width + (d.roofWidth - d.width) * h + .015 * Math.sin(h * Math.PI);
      return [side * width, d.bottom + h * (d.top - d.crown - d.bottom), (d.t - .5) * s.length];
    }, (row, col) => {
      const t = coupe ? (coupeRoof[row][0]+coupeRoof[row+1][0])/2 : (data[row].t + data[row + 1].t) / 2;
      const pane = coupe ? (t > .348 && t < .505 || t > .531 && t < .702)
        : sedan ? (t > .307 && t < .504 || t > .536 && t < .733)
        : van ? t > .223 && t < .432
        : t > .33 && t < .863 && !(t > .493 && t < .515 || t > .660 && t < .685);
      return pane && col > 0 && col < 4 ? out.glass : out.paint;
    }, false, side > 0);
  }
  if(simple||!('cockpitZ' in s))return;
  const addresses=coupe?coupeRoof.map(v=>v[0]):data.map(v=>v.t);
  const glazing=data.filter((_,i)=>addresses[i]>=windscreen[0]&&addresses[i]<=windscreen[1]);
  // The outside skin faces the sun. The separate one-sided headliner, windshield
  // header and pillar trims face occupants and close the shell around the glass.
  skin(data.length,topCuts.length,(row,col)=>{
    const d=data[row],u=topCuts[col];
    return [u*(d.roofWidth-.004),d.top-d.crown*u*u-.017,(d.t-.5)*s.length];
  },(row,col)=>{
    const t=(addresses[row]+addresses[row+1])/2,window=(t>windscreen[0]&&t<windscreen[1])||(t>backlight[0]&&t<backlight[1]);
    return window&&col>0&&col<topCuts.length-2?undefined:out.trim;
  },false,true,0x393d40);
  for(const side of [-1,1]){
    skin(data.length,sideCuts.length,(row,col)=>{
      const d=data[row],height=sideCuts[col];
      const width=d.width+(d.roofWidth-d.width)*height+.015*Math.sin(height*Math.PI)-.008;
      return [side*width,d.bottom+height*(d.top-d.crown-d.bottom)-.010,(d.t-.5)*s.length];
    },(row,col)=>{
      const t=(addresses[row]+addresses[row+1])/2;
      const pane=coupe?(t>.348&&t<.505||t>.531&&t<.702):sedan?(t>.307&&t<.504||t>.536&&t<.733)
        :t>.330&&t<.863&&!(t>.493&&t<.515||t>.660&&t<.685);
      return pane&&col>0&&col<4?undefined:out.trim;
    },false,side<0,0x34393c);
    const pillar=glazing.map((d):Point=>[d.roofWidth*.917*side,d.top-d.crown*.843-.008,(d.t-.5)*s.length]);
    if(pillar.length>1){
      bead(out.trim,pillar,.012,0x343b3c);
      bead(out.trim,pillar.map(([x,y,z]):Point=>[x-side*.014,y-.011,z+.003]),.014,0x363a3b);
    }
    const weatherstrip=data.slice(1,-1).map((d):Point=>[side*(d.width+(d.roofWidth-d.width)*.13+.009),
      d.bottom+.13*(d.top-d.crown-d.bottom),(d.t-.5)*s.length]);
    bead(out.trim,weatherstrip,.0062,0x303639);
    const pillarStart=coupe?.505:sedan?.504:.493,pillarEnd=coupe?.531:sedan?.536:.515;
    const bPillar=data.filter((_,i)=>addresses[i]>=pillarStart-.0001&&addresses[i]<=pillarEnd+.0001);
    if(bPillar.length>=2){
      skin(bPillar.length,3,(row,col)=>{
        const d=bPillar[row],k=[.13,.55,.931][col];
        return [side*(d.width+(d.roofWidth-d.width)*k+.015*Math.sin(k*Math.PI)+.002),
          d.bottom+k*(d.top-d.crown-d.bottom),(d.t-.5)*s.length];
      },()=>out.trim,false,side>0,0x262b2e);
    }
  }
  for(const d of [glazing[0],glazing.at(-1)]){
    if(d)bead(out.trim,[-.91,-.65,0,.65,.91].map((u):Point=>[u*d.roofWidth,d.top-d.crown*u*u+.001,(d.t-.5)*s.length]),.005,0x303436);
  }
}


function addTrafficDetails(out: Shell, s: VehicleSpec, simple: boolean) {
  const w = s.width, h = s.height, l = s.length, van = s.body === 'van';
  const tailY = h * (van ? .356 : .437), headY = h * (van ? .326 : .416);
  for (const side of [-1, 1]) {
    box(out.tail, [side * w * (van ? .436 : .335), tailY, l / 2 + .006], [w * (van ? .052 : .187), h * (van ? .194 : .074), .026]);
    box(out.head, [side * w * .323, headY, -l / 2 - .006], [w * .188, h * .066, .026]);
    const indicator = side < 0 ? out.left : out.right;
    box(indicator, [side * w * .418, headY, -l / 2 - .007], [w * .030, h * .065, .024]);
    box(indicator, [side * w * (van ? .437 : .417), tailY + .021, l / 2 + .020], [w * .028, h * .044, .01]);
  }
  if (simple) return;
  box(out.trim, [0, h * .284, l * .501], [w * .82, h * .065, .05], 0x353638);
  box(out.trim, [0, h * .331, l * .507], [.399, .095, .014], 0xc0beb2);
  box(out.trim, [0, headY - .015, -l * .502], [w * .39, h * .088, .032], 0x363c3e);
  if (s.body === 'estate' || s.body === 'suv') {
    for (const side of [-1, 1]) box(out.trim, [side * w * .29, h * .996, l * .105], [.039, .043, l * .40], 0x747a7b, [0, 0, 0], .014);
  }
}

export function buildShell(s: VehicleSpec, simple = false) {
  const out = newShell();
  addLowerShell(out, s, simple);
  addCabin(out, s, simple);
  if('cockpitZ' in s){
    const profile=baseProfile(s);
    sportsExterior(out,s,simple,(side,t,h)=>{
      const r=sectionAt(s,profile,t,false), y=h*s.height;
      let i=4;while(i<7&&r[i][1]<y)i++;
      const a=r[i-1],b=r[i],f=Math.max(0,Math.min(1,(y-a[1])/(b[1]-a[1]||1)));
      return [side*(a[0]+(b[0]-a[0])*f+.002),a[1]+(b[1]-a[1])*f,a[2]];
    },(side,t,width)=>{
      const r=sectionAt(s,profile,t,false),x=width*s.width*.5;
      let i=8;while(i<11&&r[i][0]>x)i++;
      const a=r[i-1],b=r[i],f=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0]||1)));
      return [side*(a[0]+(b[0]-a[0])*f),a[1]+(b[1]-a[1])*f+.002,a[2]];
    });
    wrapBumpers(out,s);
  }else addTrafficDetails(out,s,simple);
  if (!simple) {
    for (const side of [-1, 1]) {
      const z = -s.length * (s.body === 'van' ? .265 : .145);
      const y = s.height * (s.body === 'van' ? .516 : .646);
      box(out.trim, [side * s.width * .451, y - .039, z], [.142, .037, .065], 0x292e30, [0, 0, side * .20]);
      oval(out.paint, [side * s.width * .492, y, z], [.111, .055, .086]);
      oval(out.glass, [side * s.width * .492, y, z + .045], [.089, .037, .042]);
    }
  }
  return out;
}

export {buildWheel,buildCaliper} from './wheels';
