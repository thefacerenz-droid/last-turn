import type { VehicleSpec } from './catalogue';

export type InstrumentStyle = 'twin' | 'chronograph' | 'strip';

interface CabinDesign {
  cluster: InstrumentStyle;
  leather: number;
  inserts: number;
  accent: number;
  metal: number;
  eyeZ: number;
  sport: boolean;
}

// Upholstery, instrument families and seating position belong to the vehicle.
// Coordinates in this file are shared by the GLB authoring tool and the live instruments.
const touring: CabinDesign = {
  cluster:'twin', leather:0x363938, inserts:0x5c6060, accent:0xb6a38a,
  metal:0x858d8d, eyeZ:.07, sport:true,
};
const cabins: Record<string,CabinDesign> = {
  touring,
  sedan:{cluster:'strip', leather:0x382b29, inserts:0x805b4e, accent:0xc9b49d,metal:0x9b9991,eyeZ:-.12,sport:false},
  kaido:{cluster:'chronograph',leather:0x292e34,inserts:0x3a4149,accent:0xc16756,metal:0x797d82,eyeZ:.055,sport:true},
  sport:{cluster:'strip',leather:0x353233,inserts:0x6a3e39,accent:0xd99982,metal:0x989a9a,eyeZ:.12,sport:true},
  fastback:{cluster:'chronograph',leather:0x332c27,inserts:0x876c50,accent:0xcab99a,metal:0x989f99,eyeZ:-.035,sport:true},
  estate:{cluster:'strip',leather:0x303b38,inserts:0x5d655c,accent:0xc4bba5,metal:0xa6ab9e,eyeZ:-.16,sport:false},
  grand:{cluster:'twin',leather:0x392c28,inserts:0x926c4c,accent:0xd8c69e,metal:0xb1a691,eyeZ:.45,sport:false},
  muscle:{cluster:'twin',leather:0x343438,inserts:0x5e5450,accent:0xcab9a4,metal:0xababaa,eyeZ:.16,sport:false},
  exotic:{cluster:'strip',leather:0x282c2e,inserts:0x494d4e,accent:0xc59165,metal:0x849096,eyeZ:-.32,sport:true},
  midengine:{cluster:'chronograph',leather:0x323138,inserts:0x574e58,accent:0xc7a88a,metal:0x9a9b9d,eyeZ:-.36,sport:true},
  concept:{cluster:'strip',leather:0x50473d,inserts:0x715643,accent:0xcda677,metal:0x98a3a2,eyeZ:-.69,sport:true},
};

export function cabinDesign(design: string | undefined): CabinDesign {
  return cabins[design ?? ''] ?? touring;
}

export function instrumentMount(spec: VehicleSpec) {
  if(spec.design==='concept'){
    return {x:0,y:.797,z:-1.23,width:.238,height:.080,tilt:-.31};
  }
  const theme=cabinDesign(spec.design);
  const width=theme.cluster==='strip'?.356:theme.cluster==='twin'?.350:.323;
  return {x:-spec.width*.225,y:spec.height*.685,z:(spec.cockpitZ??theme.eyeZ)-.657,
    width,height:width/3.03,tilt:-.14};
}
