import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

export type Point = [number, number, number]
export const white = new Color(0xffffff)

/** One indexed mesh per surface type per road section. */
export class GeometryBatch {
  private positions: number[] = []
  private colors: number[] = []
  private uvs: number[] = []
  private indices: number[] = []

  vertex(p: Point, color = white, u = 0, v = 0) {
    const index = this.positions.length / 3
    this.positions.push(...p)
    this.colors.push(color.r, color.g, color.b)
    this.uvs.push(u, v)
    return index
  }

  tri(a: number, b: number, c: number) {
    this.indices.push(a, b, c)
  }

  face(a: number, b: number, c: number, d: number) {
    this.indices.push(a, b, d, b, c, d)
  }

  quad(a: Point, b: Point, c: Point, d: Point, color = white, u = 1, v = 1) {
    this.face(this.vertex(a, color, 0, 0), this.vertex(b, color, u, 0),
      this.vertex(c, color, u, v), this.vertex(d, color, 0, v))
  }

  finish() {
    if (!this.indices.length) return
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    geo.setIndex(this.indices)
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    return geo
  }
}

export function box(batch: GeometryBatch, center: Point, w: number, h: number, d: number, color: Color, yaw = 0) {
  const [cx, cy, cz] = center, co = Math.cos(yaw), si = Math.sin(yaw)
  const p = (x: number, y: number, z: number): Point =>
    [cx + x * co + z * si, cy + y, cz - x * si + z * co]
  const l = -w / 2, r = w / 2, b = -h / 2, t = h / 2, near = d / 2, far = -d / 2
  const a = p(l, b, near), e = p(r, b, near), f = p(r, b, far), g = p(l, b, far)
  const A = p(l, t, near), E = p(r, t, near), F = p(r, t, far), G = p(l, t, far)
  batch.quad(a, e, E, A, color)
  batch.quad(e, f, F, E, color)
  batch.quad(f, g, G, F, color)
  batch.quad(g, a, A, G, color)
  batch.quad(A, E, F, G, color)
  batch.quad(g, f, e, a, color)
}

/** An uncapped tapered spar with an arbitrary axis. Ends generally meet another part. */
export function spar(batch: GeometryBatch, a: Point, b: Point, ra: number, rb: number, color: Color, sides = 6) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 0.001) return
  const flat = Math.hypot(dx, dz), ux = flat > 0.0001 ? dz / flat : 1, uz = flat > 0.0001 ? -dx / flat : 0
  const vx = -uz * dy / len, vy = (uz * dx - ux * dz) / len, vz = ux * dy / len
  const lower: number[] = [], upper: number[] = []
  for (let i = 0; i < sides; i++) {
    const angle = 2 * Math.PI * i / sides, c = Math.cos(angle), s = Math.sin(angle)
    const x = ux * c + vx * s, y = vy * s, z = uz * c + vz * s
    lower.push(batch.vertex([a[0] + ra * x, a[1] + ra * y, a[2] + ra * z], color))
    upper.push(batch.vertex([b[0] + rb * x, b[1] + rb * y, b[2] + rb * z], color))
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    batch.face(lower[i], upper[i], upper[j], lower[j])
  }
}

/** Low-poly ellipsoid with irregular rings for rocks and vegetation. */
export function mound(batch: GeometryBatch, center: Point, radii: Point, color: Color, seed: number, sides = 7) {
  const [x, y, z] = center, [w, h, d] = radii
  const bottom = batch.vertex([x, y - h, z], color)
  const top = batch.vertex([x + w * 0.12, y + h, z - d * 0.08], color)
  const rings: number[][] = [[], []]
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < sides; i++) {
      const a = seed + (i + row * 0.22) * 2 * Math.PI / sides
      const jitter = (row ? 0.79 : 0.95) + 0.12 * Math.sin(seed + i * 38.1 + row)
      rings[row].push(batch.vertex([
        x + w * jitter * Math.cos(a),
        y + h * ((row ? 0.45 : -0.33) + Math.cos(i * 2.31 + seed) * 0.15),
        z + d * jitter * Math.sin(a),
      ], color))
    }
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    batch.tri(bottom, rings[0][i], rings[0][j])
    batch.face(rings[0][i], rings[1][i], rings[1][j], rings[0][j])
    batch.tri(rings[1][i], top, rings[1][j])
  }
}
