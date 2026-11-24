import { playerVehicle,trafficVehicles as roadFleet,type VehicleSpec as Chassis } from './specs';
import { cabinDesign } from './cabinLayout';
export interface VehicleSpec extends Chassis {category:string;defaultPaint:string;design:string;cockpitX?:number;cockpitZ?:number}
type Powertrain=[number,number,number,number,number,number,number,number];
type Dimensions=[number,number,number,number,number,number];
function model(id:string,name:string,body:Chassis['body'],category:string,design:string,color:string,dimensions:Dimensions,power:Powertrain,drive:Chassis['drivetrain'],cylinders:number,turbo:boolean):VehicleSpec {
  const [length,width,height,wheelbase,track,wheelRadius]=dimensions;
  const [mass,hp,torque,redline,topSpeed,zeroTo100,frontWeight,grip]=power;
  const gears=design==='muscle'?[2.89,1.99,1.39,1,.8,.63]:design==='sport'?[3.83,2.36,1.69,1.31,1,.82]:[4.09,2.76,2.02,1.57,1.24,1,.81];
  return {...playerVehicle,id,name,body,category,design,paint:color,defaultPaint:color,length,width,height,wheelbase,track,wheelRadius,
    mass,hp,torque,redline,topSpeed,zeroTo100,frontWeight,grip,drivetrain:drive,cylinders,turbo,gears,
    finalDrive:design==='muscle'?3.91:3.42,idle:720+cylinders*19,cgHeight:height*.365,travel:body==='estate'?.24:.205,
    spring:Math.round(mass*(design==='exotic'||design==='midengine'?31:27)),damping:Math.round(2*Math.sqrt(mass*.25*mass*27)*.51),
    antiRoll:Math.round(mass*(design==='estate'?7.1:8.3)),wheelMass:14+wheelRadius*17,cockpitZ:cabinDesign(design).eyeZ};
}
export const vehicles:VehicleSpec[]=[
  {...model('aurelia-cx','Aurelia CX','coupe','Mid-engine concept','concept','#bcc5c6',[4.65,2.14,1.227,2.987,1.80,.410],[1520,624,590,8500,325,3.2,.43,1.19],'AWD',10,false),cockpitX:0,cockpitZ:-.69},
  model('kessel-r4','Kessel R4','coupe','Performance coupe','touring','#788e88',[4.79,1.89,1.38,2.86,1.62,.343],[1705,510,650,7350,286,3.8,.53,1.09],'RWD',6,true),
  model('kessel-s5','Kessel S5','sedan','Executive sports sedan','sedan','#526974',[4.98,1.91,1.47,2.98,1.64,.349],[1885,612,745,7150,302,3.5,.54,1.07],'AWD',8,true),
  model('kaido-r','Kaido R','coupe','All-wheel drive sports coupe','kaido','#979b9a',[4.69,1.9,1.37,2.78,1.61,.35],[1740,562,631,7150,308,3.3,.54,1.14],'AWD',6,true),
  model('sazan-s','Sazan S','coupe','Short-wheelbase sports coupe','sport','#b34738',[4.39,1.85,1.29,2.47,1.59,.332],[1475,388,505,7050,264,4.3,.5,1.08],'RWD',6,true),
  model('vesper-gt','Vesper GT','coupe','Rear-engine sports car','fastback','#babec0',[4.52,1.86,1.3,2.45,1.59,.34],[1505,465,522,7750,299,3.7,.4,1.15],'RWD',6,true),
  model('arden-rs','Arden RS Touring','estate','Performance wagon','estate','#4d6156',[4.96,1.95,1.47,2.93,1.66,.358],[2045,600,790,6900,287,3.6,.56,1.05],'AWD',8,true),
  model('sterling-gt','Sterling GT','coupe','Long-hood grand tourer','grand','#636f79',[4.66,1.94,1.28,2.66,1.64,.348],[1635,554,676,7200,304,3.7,.48,1.11],'RWD',8,true),
  model('morrow-440','Morrow 440','coupe','American muscle coupe','muscle','#b17841',[5.02,1.96,1.44,2.95,1.64,.353],[1920,518,662,6400,277,4.4,.56,1.02],'RWD',8,false),
  model('valente-v10','Valente V10','coupe','Mid-engine supercar','exotic','#b87647',[4.51,1.94,1.16,2.62,1.65,.345],[1450,638,605,8650,326,3.0,.42,1.21],'AWD',10,false),
  model('corsa-z','Corsa Z','coupe','Mid-engine sports car','midengine','#647c90',[4.62,1.94,1.22,2.72,1.64,.348],[1530,502,646,6750,308,3.4,.41,1.15],'RWD',8,false),
];
const civilian:VehicleSpec[]=roadFleet.map(s=>({...s,category:s.body,design:s.body,defaultPaint:s.paint}));
const pickup={...civilian[2],id:'summit-utility',name:'Summit Utility',design:'pickup',length:5.46,wheelbase:3.22,mass:2270};
const truck={...civilian[3],id:'coastal-freight',name:'Coastal Freight',design:'freight',length:7.7,height:3.18,wheelbase:4.34,width:2.38,wheelRadius:.445,mass:5650,cgHeight:1.12};
export const trafficVehicles:VehicleSpec[]=[...civilian,pickup,truck,vehicles[1],vehicles[3],vehicles[4],vehicles[6]];
export const getVehicle=(id:string)=>vehicles.find(v=>v.id===id)??trafficVehicles.find(v=>v.id===id)??vehicles[0];
