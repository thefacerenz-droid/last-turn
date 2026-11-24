import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute,
  CatmullRomCurve3, Matrix4, Quaternion, SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Point = readonly [number, number, number];
export type Tint = string | number;

const vector = new Vector3();
const size = new Vector3();
const rotation = new Quaternion();
const angles = new Euler();
const transform = new Matrix4();
const color = new Color();
const face = new Vector3();
const edge = new Vector3();

/** Bakes rigid parts together so mirrors, trim and bodywork can share draw calls. */
export class Batch {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];

  append(geometry: BufferGeometry, tint: Tint = 0xffffff) {
    const indices = geometry.index;
    const count = indices?.count ?? geometry.getAttribute('position').count;
    color.set(tint);
    for (let i = 0; i < count; i++) this.vertex(geometry, indices?.getX(i) ?? i, color);
  }

  vertex(geometry: BufferGeometry, index: number, tint: Color) {
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    this.positions.push(p.getX(index), p.getY(index), p.getZ(index));
    this.normals.push(n.getX(index), n.getY(index), n.getZ(index));
    const c = geometry.getAttribute('color');
    this.colors.push(tint.r * (c?.getX(index) ?? 1), tint.g * (c?.getY(index) ?? 1), tint.b * (c?.getZ(index) ?? 1));
  }

  triangle(a: Point, b: Point, c: Point, tint: Tint = 0xffffff) {
    face.fromArray(b).sub(vector.fromArray(a)).cross(edge.fromArray(c).sub(vector)).normalize();
    color.set(tint);
    this.positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      this.normals.push(face.x, face.y, face.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  finish() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    return geometry;
  }
}

export function shape(batch: Batch, geometry: BufferGeometry, pos: Point, scale: Point, tilt: Point, tint: Tint) {
  transform.compose(vector.fromArray(pos), rotation.setFromEuler(angles.fromArray([tilt[0], tilt[1], tilt[2]])), size.fromArray(scale));
  geometry.applyMatrix4(transform);
  batch.append(geometry, tint);
  geometry.dispose();
}

export function box(batch: Batch, pos: Point, dimensions: Point, tint: Tint = 0xffffff, tilt: Point = [0, 0, 0], bevel = 0) {
  const [w, h, d] = dimensions;
  const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 2, h / 2, d / 2)) : new BoxGeometry(w, h, d);
  shape(batch, geometry, pos, [1, 1, 1], tilt, tint);
}

export function oval(batch: Batch, pos: Point, dimensions: Point, tint: Tint = 0xffffff, tilt: Point = [0, 0, 0]) {
  shape(batch, new SphereGeometry(1, 14, 8), pos, dimensions, tilt, tint);
}

export function cylinder(batch: Batch, pos: Point, radius: number, depth: number, tint: Tint, tilt: Point, segments = 16) {
  shape(batch, new CylinderGeometry(radius, radius, depth, segments), pos, [1, 1, 1], tilt, tint);
}

/** A constant-section bead for panel gaps, welted leather, wiring and machined trim. */
export function bead(batch: Batch, path: Point[], radius: number, tint: Tint, smooth = true, closed = false) {
  const curve = new CatmullRomCurve3(path.map(p => new Vector3(...p)), closed, 'centripetal');
  const geometry = new TubeGeometry(curve, smooth ? path.length * 3 : path.length, radius, 5, closed);
  batch.append(geometry, tint);
  geometry.dispose();
}

/** Rows follow the length, columns follow the cross section. Normals span material boundaries. */
export function skin(
  rows: number, columns: number, point: (row: number, column: number) => Point,
  destination: (row: number, column: number) => Batch | undefined, wrap = false, reverse = false, tint: Tint = 0xffffff,
) {
  const geometry = new BufferGeometry(), vertices: number[] = [], indices: number[] = [], parts: Batch[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) vertices.push(...point(row, col));
  }
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - (wrap ? 0 : 1); col++) {
      const a = row * columns + col, c = row * columns + (col + 1) % columns;
      const b = a + columns, d = c + columns;
      const part=destination(row,col);
      if(!part)continue;
      indices.push(...(reverse ? [a, c, b, c, d, b] : [a, b, c, c, b, d]));
      parts.push(part);
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  color.set(tint);
  for (let i = 0; i < indices.length; i++) parts[Math.floor(i / 6)].vertex(geometry, indices[i], color);
  geometry.dispose();
}
