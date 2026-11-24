import {
  CanvasTexture, ClampToEdgeWrapping, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter,
  MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2,
  type Texture,
} from 'three'
import type { Graphics } from '../settings/SettingsManager'
import { ROUTES, scatter, type RouteId } from './roads'

type Pixel = (x: number, y: number) => readonly number[]

function tile(width: number, height: number, pixel: Pixel, anisotropy: number, color = true) {
  const bytes = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgb = pixel(x, y), i = (y * width + x) * 4
    bytes[i] = Math.max(0, Math.min(255, rgb[0]))
    bytes[i + 1] = Math.max(0, Math.min(255, rgb[1]))
    bytes[i + 2] = Math.max(0, Math.min(255, rgb[2]))
    bytes[i + 3] = 255
  }
  const t = new DataTexture(bytes, width, height)
  t.wrapS = t.wrapT = RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  t.anisotropy = anisotropy
  if (color) t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

const destinations = {
  pacific: ['San Aurelio', 'Ocean Beach'],
  marina: ['Port Alondra', 'Waterfront'],
  mesa: ['Sierra Loma', 'Summit Pass'],
}

// Pixel rectangles in the road-sign atlas, in canvas coordinates.
export const plates = {
  overhead: [4, 4, 754, 280], limit: [777, 4, 187, 244], bend: [4, 301, 200, 200],
  route: [223, 302, 180, 196], exit: [426, 310, 434, 179],
} as const
export type Plate = keyof typeof plates

function signAtlas(route: RouteId, anisotropy: number): Texture {
  if (typeof document === 'undefined') return tile(1, 1, () => [50, 112, 83], 1)
  const atlas = document.createElement('canvas')
  atlas.width = 1024
  atlas.height = 512
  const c = atlas.getContext('2d')
  if (!c) return tile(1, 1, () => [50, 112, 83], 1)
  const white = '#f7f3db', green = '#135b49', black = '#292b27'
  const number = ROUTES.find(r => r.id === route)!.shield.replace(/^0/, '')
  c.fillStyle = '#25453c'
  c.fillRect(0, 0, atlas.width, atlas.height)

  function rounded(x: number, y: number, w: number, h: number, radius: number, color: string) {
    c!.fillStyle = color
    c!.beginPath()
    c!.roundRect(x, y, w, h, radius)
    c!.fill()
  }
  function label(str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
    c!.font = 'bold ' + size + 'px Arial, sans-serif'
    c!.textAlign = align
    c!.textBaseline = 'middle'
    c!.fillStyle = color
    c!.fillText(str, x, y)
  }

  rounded(4, 4, 754, 280, 10, green)
  rounded(12, 12, 738, 264, 9, white)
  rounded(17, 17, 728, 254, 6, green)
  c.fillStyle = white
  c.beginPath()
  c.moveTo(46, 54); c.lineTo(77, 40); c.lineTo(111, 54); c.lineTo(107, 92)
  c.quadraticCurveTo(99, 111, 78, 118); c.quadraticCurveTo(50, 110, 46, 92)
  c.closePath(); c.fill()
  label(number, 79, 82, 42, green, 'center')
  label(route === 'mesa' ? 'EAST' : 'NORTH', 128, 80, 42, white)
  label(destinations[route][0], 45, 184, 76, white)
  c.strokeStyle = white; c.lineWidth = 13; c.lineCap = 'square'; c.lineJoin = 'miter'
  c.beginPath(); c.moveTo(673, 183); c.lineTo(673, 97)
  c.moveTo(645, 127); c.lineTo(673, 97); c.lineTo(701, 127); c.stroke()

  rounded(777, 4, 187, 244, 10, '#ebe9dd')
  rounded(784, 11, 173, 230, 7, black)
  rounded(789, 16, 163, 220, 5, '#ebe9dd')
  label('SPEED', 871, 59, 36, black, 'center')
  label('LIMIT', 871, 98, 35, black, 'center')
  label(route === 'marina' ? '55' : '65', 871, 173, 90, black, 'center')

  rounded(4, 301, 200, 200, 13, '#e9b641')
  rounded(12, 309, 184, 184, 9, black)
  rounded(17, 314, 174, 174, 7, '#e9b641')
  c.strokeStyle = black; c.lineWidth = 14
  c.beginPath(); c.moveTo(112, 467); c.bezierCurveTo(113, 425, 69, 411, 95, 366); c.stroke()
  c.fillStyle = black
  c.beginPath(); c.moveTo(104, 340); c.lineTo(74, 367); c.lineTo(113, 379); c.closePath(); c.fill()

  rounded(223, 302, 180, 196, 16, '#f7f3db')
  rounded(229, 308, 168, 184, 12, green)
  label('ROUTE', 313, 348, 30, white, 'center')
  label(number, 313, 424, 88, white, 'center')

  rounded(426, 310, 434, 179, 8, white)
  rounded(434, 318, 418, 163, 5, green)
  label('EXIT', 469, 357, 35, white)
  label(destinations[route][1], 469, 420, 44, white)
  const t = new CanvasTexture(atlas)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.anisotropy = anisotropy
  return t
}

export class RoadMaterials {
  readonly solid = new MeshLambertMaterial({ vertexColors: true })
  readonly leaves = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })
  readonly lamps = new MeshBasicMaterial({ vertexColors: true })
  readonly paint = new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
  readonly asphalt: MeshStandardMaterial
  readonly soil: MeshLambertMaterial
  readonly signs: MeshLambertMaterial
  readonly billboard: MeshLambertMaterial
  readonly windows: MeshLambertMaterial
  readonly ocean: MeshStandardMaterial
  readonly waterNormals: DataTexture
  private textures: Texture[]

  constructor(route: RouteId, graphics: Graphics) {
    const aniso = Math.max(1, Math.min(16, graphics.anisotropy))
    const size = Math.max(128, Math.min(2048, graphics.texture))
    const asphalt = tile(size, size, (x, y) => {
      const u = x / size, n = scatter(x + 8191 * y)
      const wheelPath = Math.cos((u - 0.25) * Math.PI * 4)
      const aggregate = (n - 0.5) * 33 + (n > 0.965 ? 22 : 0)
      const base = 79 - 4 * wheelPath + aggregate + 2 * Math.sin(14 * u + 0.2 * Math.sin(y * 2 * Math.PI / size))
      return [base, base + 1, base + 2]
    }, aniso)
    const soil = tile(96, 96, (x, y) => {
      const n = scatter(x + 8963 * y), noise = 226 + n * 28 - (n < 0.07 ? 26 : 0)
      return [noise, noise, noise]
    }, Math.min(aniso, 4))
    const glass = tile(128, 128, (x, y) => {
      const windowX = x % 24, row = y % 16
      if (windowX < 2 || windowX > 22 || row < 3) return [186, 185, 173]
      if (row === 3 || windowX === 2) return [93, 104, 104]
      const group = scatter(Math.floor(x / 24) + Math.floor(y / 16) * 911)
      const brightness = 88 + 51 * group + row * 1.7 + 11 * Math.cos(x / 31 + y / 24)
      return [brightness * 0.82, brightness * 1.04, brightness * 1.11]
    }, aniso)
    this.waterNormals = tile(128, 128, (x, y) => {
      const u = x * Math.PI / 64, v = y * Math.PI / 64
      const a = Math.sin(3 * u + 6 * v + 0.9 * Math.sin(u + v)) * 0.15
      const b = Math.sin(u + 11 * v + 1.5 * Math.sin(2 * u)) * 0.18
      return [128 + 127 * (a + b * 0.4), 128 + 127 * (b + a * 0.5), 250]
    }, Math.min(aniso, 4), false)
    const litWindows=tile(128,128,(x,y)=>{
      const pane=x%24,row=y%16,pick=scatter(Math.floor(x/24)+113*Math.floor(y/16));
      if(pane<2||pane>22||row<3||pick<.45)return [4,5,7];
      const glow=(.49+.42*pick)*(row===3?.60:1);
      return pick>.82?[194*glow,207*glow,210*glow]:[254*glow,214*glow,153*glow];
    },aniso);
    const signs = signAtlas(route, aniso)
    const board=document.createElement('canvas');board.width=512;board.height=192;
    const ctx=board.getContext('2d')!;
    ctx.fillStyle=route==='marina'?'#24434b':route==='mesa'?'#70452e':'#355b51';ctx.fillRect(0,0,512,192);
    ctx.fillStyle='#d5a96a';ctx.beginPath();ctx.arc(432,57,42,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d8d6b6';ctx.lineWidth=2;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(0,151+i*9);ctx.bezierCurveTo(159,104+i*10,275,217+i*8,512,90+i*10);ctx.stroke();}
    ctx.fillStyle='#f1e8d2';ctx.font='bold 44px Georgia';ctx.fillText(route==='pacific'?'Pacific View':route==='marina'?'Alondra Marina':'Sierra Lodge',20,76);
    ctx.font='600 16px Arial';ctx.fillText(route==='marina'?'HARBOR  ·  BERTHS  ·  SERVICE':'MOTOR LODGE   /   NEXT EXIT',23,108);
    const boardTex=new CanvasTexture(board);boardTex.colorSpace=SRGBColorSpace;boardTex.anisotropy=aniso;
    this.billboard=new MeshLambertMaterial({map:boardTex,emissive:'#f2dfa6',emissiveMap:boardTex,emissiveIntensity:.11});
    this.textures = [asphalt, soil, glass, litWindows, this.waterNormals, signs, boardTex]
    this.asphalt = new MeshStandardMaterial({ map: asphalt, vertexColors: true, roughness: 0.94, metalness: 0 })
    this.soil = new MeshLambertMaterial({ map: soil, vertexColors: true })
    this.signs = new MeshLambertMaterial({ map: signs, emissive: '#141b12', emissiveIntensity: 0.3 })
    this.windows = new MeshLambertMaterial({ map: glass, emissiveMap:litWindows, vertexColors: true })
    this.ocean = new MeshStandardMaterial({
      color: route === 'marina' ? '#477678' : '#497f87', metalness: 0.47, roughness: 0.22,
      normalMap: this.waterNormals, normalScale: new Vector2(0.48, 0.65),
    })
  }

  dispose() {
    for (const m of [this.solid, this.leaves, this.lamps, this.paint, this.asphalt, this.soil, this.signs,this.billboard, this.windows, this.ocean]) m.dispose()
    for (const t of this.textures) t.dispose()
  }
}
