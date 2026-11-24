import { LatheGeometry, TorusGeometry, Vector2 } from 'three';
import { Batch, box, cylinder, oval, shape, skin, type Point } from './geometry';
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

function addLowerShell(out: Shell, s: VehicleSpec, simple: boolean) {
  const profile = baseProfile(s), half = s.width / 2, archRadius = s.wheelRadius + .037;
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
    const [, w, deck, belt] = interpolate(profile, t);
    const z = (t - .5) * s.length, wide = half * w;
    const clearance = s.body === 'suv' ? .235 : .15;
    const dz = Math.abs(Math.abs(z) - s.wheelbase / 2);
    const arch = !simple && dz < archRadius
      ? s.wheelRadius + .006 + Math.sqrt(archRadius * archRadius - dz * dz)
      : clearance;
    const flare=Math.exp(-Math.pow(dz/(archRadius*1.44),4));
    const side = Math.max(belt * s.height + .027*flare, arch + .030);
    const crown = Math.max((belt + .029) * s.height, side + .017);
    const waist = arch + (side - arch) * .52;
    const section = [
      [0, clearance], [.63, clearance], [.85, clearance + .007], [.943, arch],
      [.967, arch + .012], [.983+.017*flare, waist], [.997, side - .012], [.970, side],
      [.862, crown], [.69, crown * .54 + deck * s.height * .46], [.43, deck * s.height + .01], [0, deck * s.height],
    ];
    const left = section.map(([x, y]): Point => [-x * wide, y, z]);
    const right = section.slice(1, -1).reverse().map(([x, y]): Point => [x * wide, y, z]);
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
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (end === 0) out.paint.triangle(center, a, b);
      else out.paint.triangle(center, b, a);
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

function addCabin(out: Shell, s: VehicleSpec) {
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
}

function rearBand(batch: Batch, s: VehicleSpec, height: number, thickness: number, extra: number, tint: number) {
  const half = s.width / 2;
  const halfPath = [[0, 1], [.819, 1], [.863, .994], [.918, .981], [.952, .960], [.973, .934]];
  const path = halfPath.slice(1).reverse().map(([x, t]) => [-x, t]).concat(halfPath);
  const point = (i: number, up: number): Point => {
    const [x, t] = path[i];
    return [x * (half + extra), s.height * height + up * thickness + Math.abs(x) ** 2 * .022, (t - .5) * s.length + extra];
  };
  for (let i = 0; i < path.length - 1; i++) {
    const a = point(i, -.5), b = point(i + 1, -.5), c = point(i + 1, .5), d = point(i, .5);
    batch.triangle(a, b, c, tint);
    batch.triangle(a, c, d, tint);
  }
}

function addCoupeDetails(out: Shell, s: VehicleSpec, simple: boolean) {
  const w = s.width, h = s.height, l = s.length;
  if(s.design && s.design!=='fastback'){
    const angular=s.design==='exotic'||s.design==='midengine',muscle=s.design==='muscle',round=s.design==='kaido';
    const base=(s.design==='sport'?.41:angular?.368:muscle?.444:.419)*h;
    for(const side of [-1,1]){
      const yaw=side*(angular?.47:.23);
      const rearX=side*w*.327;
      if(round||muscle){
        for(const dx of [-.095,.095])oval(out.tail,[rearX+dx,h*.492,l*.498],[.073,.063,.024],0xffffff);
      }else{
        box(out.tail,[rearX,h*(angular?.474:.453),l*.497],[w*.263,angular?.030:.052,.039],0xffffff,[0,side*.14,side*(angular?.085:0)],.016);
      }
      box(out.trim,[side*w*.335,base,-l*.477],[w*.257,.098,.095],0x242829,[0,-yaw,0],.032);
      if(muscle){for(const dx of [-.077,.077])oval(out.head,[side*w*.34+dx,base,-l*.489],[.055,.055,.027],0xffffff);}
      else box(out.head,[side*w*.343,base+.019,-l*.487],[w*.21,angular?.029:.037,.032],0xffffff,[0,-yaw,side*(angular?.13:.043)],.014);
      box(side<0?out.left:out.right,[side*w*.43,base+.008,-l*.473],[.052,.034,.035],0xffffff,[0,-yaw,0],.009);
      box(side<0?out.left:out.right,[side*w*.431,h*.452,l*.485],[.047,.031,.033],0xffffff);
      if(!simple){
        box(out.trim,[side*w*.319,h*.235,l*.485],[w*.22,.09,.107],0x222426,[0,side*.14,0],.022);
        cylinder(out.trim,[side*w*.325,h*.225,l*.497],.045,.11,0x858a8b,[Math.PI/2,0,0],16);
        box(out.trim,[side*w*.47,h*.165,0],[.10,.066,l*.56],0x303234,[0,0,0],.022);
        box(out.trim,[side*w*.478,h*.53,l*.011],[.017,.025,.105],0x696b6a,[0,0,0],.006);
        if(angular)box(out.trim,[side*w*.475,h*.395,l*.197],[.045,h*.20,l*.13],0x222728,[.27,0,side*.07],.024);
      }
    }
    box(out.trim,[0,base-.11,-l*.501],[w*(muscle?.79:.56),.144,.045],0x202426,[.10,0,0],.021);
    box(out.trim,[0,.165,-l*.484],[w*.88,.047,.206],0x292c2c,[-.04,0,0],.02);
    if(!simple){
      for(let i=0;i<4;i++)box(out.trim,[0,base-.16+i*.029,-l*.505],[w*(muscle?.72:.49),.008,.013],0x636866);
      for(const side of [-1,1]){
        box(out.trim,[side*w*.372,base-.12,-l*.498],[w*.13,.101,.043],0x252828,[0,-side*.18,0],.019);
        const x=side*w*.478;
        box(out.trim,[x,h*.430,l*.082],[.010,h*.24,.012],0x525554,[-.14,0,0]);
        box(out.trim,[side*w*.477,h*.549,l*.067],[.024,.031,.143],0x444a49,[0,0,0],.011);
      }
    }
    if(round||s.design==='exotic'){
      for(const side of [-1,1])box(out.trim,[side*w*.29,h*.61,l*.381],[.049,.143,.11],0x262829);
      box(out.paint,[0,h*.697,l*.389],[w*.845,.048,.19],0xffffff,[-.075,0,0],.02);
    }
    return;
  }
  rearBand(out.trim, s, .443, .11, .008, 0x272629);
  rearBand(out.tail, s, .448, .051, .013, 0xffffff);
  for (const side of [-1, 1]) {
    const lamp: Point = [side * w * .385, h * .516, -l * .423];
    oval(out.trim, lamp, [.163, .132, .043], 0x2b3031, [.80, side * .18, 0]);
    oval(out.head, [lamp[0], lamp[1] + .012, lamp[2] - .016], [.146, .117, .039], 0xffffff, [.80, side * .18, 0]);
    const indicator = side < 0 ? out.left : out.right;
    box(indicator, [side * w * .38, h * .342, -l * .496], [.19, .033, .028], 0xffffff, [0, -side * .25, 0]);
    box(indicator, [side * w * .435, h * .415, l * .493], [.09, .026, .025], 0xffffff, [0, side * .31, 0]);
  }
  // The raised aerofoil follows the curvature of the rear deck.
  for (const side of [-1, 1]) {
    box(out.trim, [side * w * .285, h * .605, l * .385], [.075, .125, .21], 0x222626, [.12, 0, 0], .02);
  }
  box(out.paint, [0, h * .649, l * .395], [w * .875, .069, .224], 0xffffff, [-.10, 0, 0], .029);
  if (simple) return;
  for (let i = 0; i < 7; i++) {
    box(out.trim, [0, h * .563 - i * .0012, l * .341 + i * .036], [w * (.53 - i * .007), .013, .018], 0x2a3031);
  }
  box(out.trim, [0, h * .238, l * .491], [w * .80, .119, .095], 0x222426, [.13, 0, 0], .021);
  box(out.trim, [0, h * .324, l * .501], [.446, .164, .017], 0x35383a, [0, 0, 0], .007);
  for (const side of [-1, 1]) {
    const x = side * w * .335;
    cylinder(out.trim, [x, .239, l * .496], .064, .15, 0xb6b4ad, [Math.PI / 2, 0, 0], 18);
    cylinder(out.trim, [x, .239, l * .496 + .076], .048, .0015, 0x181a1b, [Math.PI / 2, 0, 0], 18);
    box(out.trim, [side * w * .454, .239, .01], [.041, .073, s.wheelbase - s.wheelRadius * 2 - .20], 0x333738, [0, 0, 0], .012);
    box(out.trim, [side * w * .468, h * .529, l * .054], [.024, .031, .152], 0x565c5f, [0, 0, 0], .012);
    box(out.trim, [side * w * .290, h * .307, -l * .5], [.30, .065, .022], 0x262b2c, [0, -side * .15, 0], .014);
  }
  box(out.trim, [0, h * .251, -l * .496], [w * .36, .071, .046], 0x202527, [0, 0, 0], .016);
  box(out.trim, [0, .158, -l * .461], [w * .885, .031, .245], 0x33383a, [0, 0, 0], .012);
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
  addCabin(out, s);
  if (s.body === 'coupe') addCoupeDetails(out, s, simple);
  else addTrafficDetails(out, s, simple);
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

export function buildWheel(s: VehicleSpec, rimColor: string, detailed: boolean, wheelStyle = 0) {
  const batch = new Batch(), r = s.wheelRadius;
  const halfWidth = Math.min(s.width - s.track, s.body === 'coupe' ? .265 : .23) * .48;
  const segments = detailed ? 32 : 12;
  const cross = [[.62, -1], [.80, -1], [.93, -.92], [.99, -.70], [1, -.50], [1, .50], [.99, .70], [.93, .92], [.81, 1], [.62, 1]];
  const profile = cross.map(([radius, axis]) => new Vector2(radius * r, axis * halfWidth));
  shape(batch, new LatheGeometry(profile, segments), [0, 0, 0], [1, 1, 1], [0, 0, -Math.PI / 2], 0x212326);
  const faceX = halfWidth * 1.015;
  cylinder(batch, [halfWidth * .65, 0, 0], r * .735, halfWidth * .42, 0x363c42, [0, 0, -Math.PI / 2], segments);
  cylinder(batch, [halfWidth * .78, 0, 0], r * .53, halfWidth * .055, 0x414749, [0, 0, -Math.PI / 2], segments);
  if (detailed) {
    shape(batch, new TorusGeometry(r * .71, .012, 5, segments), [faceX, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0], 0xb7bdc0);
  }
  const count = wheelStyle === 2 ? 12 : wheelStyle === 1 ? 8 : detailed ? 5 : 6;
  const point = (angle: number, radius: number, x: number): Point => [x, Math.cos(angle) * radius * r, Math.sin(angle) * radius * r];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, reach = detailed ? .70 : .69;
    const rootA = point(a - .16, .17, faceX + .002), rootB = point(a + .16, .17, faceX + .002);
    const outerA = point(a - .072, reach, faceX), outerB = point(a + .095, reach, faceX);
    batch.triangle(rootA, outerA, outerB, rimColor);
    batch.triangle(rootA, outerB, rootB, rimColor);
    if (detailed) {
      const secondary = point(a + .277, reach, faceX), mid = point(a + .085, .40, faceX + .003);
      batch.triangle(mid, point(a + .209, reach, faceX), secondary, rimColor);
      cylinder(batch, point(a, .112, faceX + .012), .009, .013, 0xb8bebf, [0, 0, -Math.PI / 2], 6);
    }
  }
  cylinder(batch, [faceX + .005, 0, 0], r * .17, .015, rimColor, [0, 0, -Math.PI / 2], 16);
  return batch.finish();
}
