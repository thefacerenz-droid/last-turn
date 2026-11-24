export const handlingTunes = {
  Stock: {front:1, rear:1, power:1, drag:1, lock:1, steering:1, description:'Factory handling and engine calibration.'},
  Grip: {front:1.22, rear:1.25, power:1, drag:1.04, lock:1, steering:1, description:'High-grip tires favor stable cornering and braking.'},
  Speed: {front:1, rear:1, power:1.22, drag:.83, lock:1, steering:1, description:'More engine power and less drag for long straights.'},
  Drift: {front:1.12, rear:.76, power:1.08, drag:1, lock:2.5, steering:1.3, description:'Looser rear tires, stronger differential locking and more steering lock for slides.'},
  'Grip + Speed': {front:1.13, rear:1.15, power:1.12, drag:.93, lock:1, steering:1, description:'Sport tires and a moderate power increase for fast lane changes.'},
} as const;
export type HandlingTune = keyof typeof handlingTunes;
