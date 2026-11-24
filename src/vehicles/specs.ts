type BodyStyle = 'coupe' | 'sedan' | 'estate' | 'suv' | 'van';

export interface VehicleSpec {
  id: string;
  name: string;
  body: BodyStyle;
  design?: string;
  paint: string;
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  track: number;
  wheelRadius: number;
  mass: number;
  cgHeight: number;
  frontWeight: number;
  spring: number;
  damping: number;
  travel: number;
  antiRoll: number;
  wheelMass: number;
  grip: number;
  drivetrain: 'AWD' | 'RWD' | 'FWD';
  hp: number;
  torque: number;
  topSpeed: number;
  zeroTo100: number;
  gears: number[];
  finalDrive: number;
  redline: number;
  idle: number;
  turbo: boolean;
  cylinders: number;
}

export const playerVehicle: VehicleSpec = {
  id: 'vesper-gt', name: 'Vesper GT', body: 'coupe', paint: '#b9c2c5',
  length: 4.55, width: 1.88, height: 1.34, wheelbase: 2.72, track: 1.61,
  wheelRadius: .335, mass: 1590, cgHeight: .47, frontWeight: .51,
  spring: 43000, damping: 3800, travel: .22, antiRoll: 12500,
  wheelMass: 19, grip: 1.12, drivetrain: 'AWD', hp: 480, torque: 540,
  topSpeed: 285, zeroTo100: 4.1, gears: [4.1, 2.72, 1.94, 1.48, 1.18, .96, .81],
  finalDrive: 3.63, redline: 7500, idle: 880, turbo: true, cylinders: 6,
};

const sedan: VehicleSpec = {
  ...playerVehicle,
  id: 'bellmont', name: 'Bellmont', body: 'sedan', paint: '#547082',
  length: 4.72, width: 1.83, height: 1.46, wheelbase: 2.78, track: 1.56,
  wheelRadius: .32, mass: 1510, cgHeight: .51, frontWeight: .57, grip: .96,
  hp: 182, torque: 244, topSpeed: 218, zeroTo100: 7.8,
  gears: [3.75, 2.14, 1.43, 1.02, .81, .67], finalDrive: 3.82,
  drivetrain: 'FWD', redline: 6500, idle: 760, turbo: false, cylinders: 4,
};

export const trafficVehicles: readonly VehicleSpec[] = [
  sedan,
  {
    ...sedan, id: 'monterey', name: 'Monterey Estate', body: 'estate', length: 4.83,
    height: 1.58, wheelbase: 2.83, mass: 1680, cgHeight: .56, paint: '#b2b3a5',
  },
  {
    ...sedan, id: 'summit', name: 'Summit', body: 'suv',
    length: 4.94, width: 1.98, height: 1.8, wheelbase: 2.91, track: 1.68,
    wheelRadius: .39, mass: 2100, cgHeight: .65, spring: 52000, drivetrain: 'AWD',
    hp: 265, torque: 337, cylinders: 6, paint: '#596448',
  },
  {
    ...sedan, id: 'courier', name: 'Courier', body: 'van',
    length: 5.68, width: 2.04, height: 2.35, wheelbase: 3.54, track: 1.7,
    wheelRadius: .37, mass: 2520, cgHeight: .76, spring: 61000, paint: '#d3cbb9',
    hp: 162, torque: 348, redline: 4900, turbo: true,
  },
];
