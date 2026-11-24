"""Build the Kuroda RS Club from the two licensed Socksthecat meshes.

Python 3, NumPy and Pillow. See public/assets/licensed/kuroda-rs/CREDITS.md.
Give the path to a directory containing the upstream OGRE meshes and PNG atlases.
"""
from collections import defaultdict
from dataclasses import dataclass
from io import BytesIO
import json
from pathlib import Path
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont


@dataclass
class Surface:
    name: str
    pos: np.ndarray
    norm: np.ndarray
    uv: np.ndarray
    faces: np.ndarray


def chunks(binary, start, end):
    while start + 6 <= end:
        key, length = struct.unpack_from("<HI", binary, start)
        if length < 6 or start + length > end:
            raise ValueError(f"Invalid OGRE chunk at {start}")
        yield key, start + 6, start + length
        start += length


def read_mesh(path):
    """Read this source's OGRE v1.8 shared float vertex buffer and triangle lists."""
    data = path.read_bytes()
    prefix = b"\x00\x10[MeshSerializer_v1.8]\n"
    if not data.startswith(prefix):
        raise ValueError(f"Unexpected file format: {path}")
    # OGRE 1.8 includes the serializer version string in its outer length.
    start, end = len(prefix) + 6, len(data)
    surfaces = []
    pos = norm = uv = None
    for kind, p, last in chunks(data, start + 1, end):
        if kind == 0x5000:
            count, = struct.unpack_from("<I", data, p)
            for k, a, b in chunks(data, p + 4, last):
                if k == 0x5200:
                    source, stride = struct.unpack_from("<HH", data, a)
                    if source != 0 or stride != 44:
                        raise ValueError("Unsupported OGRE vertex declaration")
                    _, first, _ = next(chunks(data, a + 4, b))
                    v = np.frombuffer(data, "<f4", count=count * 11, offset=first).reshape(-1, 11)
                    pos, norm, uv = v[:, :3], v[:, 3:6], v[:, 6:8]
        elif kind == 0x4000:
            sep = data.index(10, p, last)
            name = data[p:sep].decode()
            shared, count, wide = struct.unpack_from("<?I?", data, sep + 1)
            if not shared or pos is None:
                raise ValueError("Expected shared vertices")
            indices = np.frombuffer(data, "<u4" if wide else "<u2", count=count, offset=sep + 7)
            surfaces.append(Surface(name, pos, norm, uv, indices.reshape(-1, 3)))
    return surfaces


def components(surface):
    """Group triangles by welded positions, also connecting across UV and normal seams."""
    _, weld = np.unique(np.round(surface.pos, 4), axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    parents = np.arange(weld.max() + 1)

    def root(index):
        while index != parents[index]:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for a, b, c in weld[surface.faces]:
        base = root(a)
        parents[root(b)] = parents[root(c)] = base
    ids = np.fromiter((root(i) for i in weld[surface.faces[:, 0]]), dtype=np.int32)
    order = np.argsort(ids, kind="stable")
    return np.split(order, np.flatnonzero(np.diff(ids[order])) + 1)


class Gltf:
    def __init__(self):
        self.binary = bytearray()
        self.doc = {
            "asset": {"version": "2.0", "copyright": "Vehicle and wheel by Socksthecat; Stunt Rally mesh preparation by CryHam. CC BY 4.0. See CREDITS.md."},
            "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "materials": [],
            "buffers": [{}], "bufferViews": [], "accessors": [], "images": [], "textures": [],
            "extensionsUsed": ["KHR_materials_clearcoat"],
        }
        self.materials = {}

    def push(self, key, value):
        result = len(self.doc[key])
        self.doc[key].append(value)
        return result

    def view(self, data, target=None):
        self.binary.extend(bytes(-len(self.binary) % 4))
        view = {"buffer": 0, "byteOffset": len(self.binary), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.binary.extend(data)
        return self.push("bufferViews", view)

    def accessor(self, arr, kind, component, target, bounds=False):
        dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}[component]
        arr = np.ascontiguousarray(arr, dtype=dtype)
        accessor = {"bufferView": self.view(arr.tobytes(), target), "componentType": component, "count": len(arr), "type": kind}
        if bounds:
            accessor.update(min=arr.min(0).tolist(), max=arr.max(0).tolist())
        return self.push("accessors", accessor)

    def texture(self, file, exponent=1.0, lift=0):
        im = Image.open(file).convert("RGB")
        lut = [min(255, int(255*(v/255)**exponent + lift)) for v in range(256)]
        im = im.point(lut * 3)
        return self.image_texture(im, file.stem)

    def image_texture(self, im, name):
        jpg = BytesIO()
        im.save(jpg, "JPEG", quality=85, optimize=True)
        image = self.push("images", {"mimeType": "image/jpeg", "bufferView": self.view(jpg.getvalue()), "name": name})
        return self.push("textures", {"source": image})

    def material(self, name, color, metal, rough, texture=None, clearcoat=0, blend=False):
        pbr = {"baseColorFactor": color, "metallicFactor": metal, "roughnessFactor": rough}
        if texture is not None:
            pbr["baseColorTexture"] = {"index": texture}
        mat = {"name": name, "pbrMetallicRoughness": pbr}
        if clearcoat:
            mat["extensions"] = {"KHR_materials_clearcoat": {"clearcoatFactor": clearcoat, "clearcoatRoughnessFactor": .15}}
        if blend:
            mat.update(alphaMode="BLEND", doubleSided=True)
        self.materials[name] = self.push("materials", mat)

    def primitive(self, surface, subset, material, matrix, offset):
        indices = surface.faces[subset]
        selected, remapped = np.unique(indices.ravel(), return_inverse=True)
        positions = surface.pos[selected] @ matrix.T + offset
        normals = surface.norm[selected] @ matrix.T
        attrs = {
            "POSITION": self.accessor(positions, "VEC3", 5126, 34962, bounds=True),
            "NORMAL": self.accessor(normals, "VEC3", 5126, 34962),
            "TEXCOORD_0": self.accessor(surface.uv[selected], "VEC2", 5126, 34962),
        }
        return {"material": self.materials[material], "attributes": attrs,
                "indices": self.accessor(remapped, "SCALAR", 5123 if len(selected) <= 65535 else 5125, 34963)}

    def node(self, name, **kwargs):
        return self.push("nodes", {"name": name, **kwargs})

    def root(self, name, **kwargs):
        index = self.node(name, **kwargs)
        self.doc["scenes"][0]["nodes"].append(index)
        return index

    def write(self, path):
        self.doc["buffers"][0]["byteLength"] = len(self.binary)
        self.binary.extend(bytes(-len(self.binary) % 4))
        header = json.dumps(self.doc, separators=(",", ":")).encode()
        header += b" " * (-len(header) % 4)
        size = 28 + len(header) + len(self.binary)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as stream:
            stream.write(struct.pack("<4sII", b"glTF", 2, size))
            stream.write(struct.pack("<I4s", len(header), b"JSON"))
            stream.write(header)
            stream.write(struct.pack("<I4s", len(self.binary), b"BIN\0"))
            stream.write(self.binary)


IDENTITY = np.eye(3)
# The source chassis uses -X forward, -Y up, +Z right. Source wheel axles already use X.
CHASSIS = np.array([[0, 0, 1], [0, -1, 0], [1, 0, 0]])
FLOOR = np.array([0, .625, 0])


def console_face():
    """Baked lettering and vent fins for the fixed dashboard trim assembly."""
    im = Image.new("RGB", (480, 240), "#25282b")
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((2, 2, 477, 237), 13, outline="#55585a", width=4)
    draw.rounded_rectangle((14, 15, 465, 109), 8, fill="#0f1112", outline="#373b3d", width=5)
    for y in range(25, 97, 13):
        draw.line((24, y, 456, y), fill="#63676a", width=3)
        draw.line((24, y+3, 456, y+3), fill="#282a2b", width=5)
    for x in [115, 236, 360]:
        draw.rectangle((x-4, 23, x+4, 98), fill="#505154")
    for x in (120, 336):
        draw.rounded_rectangle((x-18, 54, x+18, 66), 3, fill="#878b8b", outline="#3f4445", width=2)
    for x, label in [(85, "TEMP"), (239, "VENT"), (394, "FAN")]:
        draw.text((x, 225), label, fill="#c6c3b8", anchor="ms", font=ImageFont.load_default(size=15))
        for angle in np.linspace(35, 325, 10):
            r = np.radians(angle)
            direction = np.array([np.sin(r), np.cos(r)])
            c = np.array([x, 162]); a, b = c+34*direction, c+39*direction
            draw.line(tuple(a)+tuple(b), fill="#d5d0bf", width=2)
    draw.line((37, 176, 45, 176), fill="#68a1ae", width=4)
    draw.line((127, 176, 135, 176), fill="#c66c52", width=4)
    return im


def console_geometry(gltf):
    # Fit the panel to the original inclined fascia. +Z points toward the cabin.
    center = np.array([0., .833, -.320])
    up = np.array([0., .945, -.327])
    normal = np.array([0., .327, .945])
    right = np.array([1., 0., 0.])
    def primitive(name, pos, norm, uv, faces):
        surf = Surface(name, np.array(pos), np.array(norm), np.array(uv), np.array(faces))
        return gltf.primitive(surf, np.arange(len(faces)), name, IDENTITY, np.zeros(3))
    w, h = .207, .102
    corners = [center + right*x*w + up*y*h for x,y in ((-.5,.5),(-.5,-.5),(.5,-.5),(.5,.5))]
    block = primitive("console-trim", corners, [normal]*4, [(0,0),(0,1),(1,1),(1,0)], [(0,1,2),(2,3,0)])
    pos, norm, faces = [], [], []
    n = 48
    # Each dial has a ribbed elastomer grip and a beveled anodized lip.
    for u in [85/480, 239/480, 394/480]:
        axis = center + right*((u-.5)*w) + up*((.5-162/240)*h)
        start = len(pos)
        for level, radius, bevel in [(0,.012,.10),(.007,.012,.18),(.009,.0106,.72),(.0098,0,1)]:
            for i in range(n):
                a = np.pi*2*i/n
                radial = right*np.cos(a)+up*np.sin(a)
                radius_i = radius + (.00055 if i%2 and level<.009 else 0)
                pos.append(axis+level*normal+radius_i*radial)
                nr = normal*bevel + radial*(1-bevel)
                norm.append(nr/np.linalg.norm(nr))
        for ring in range(3):
            for i in range(n):
                a = start+ring*n+i; b = start+ring*n+(i+1)%n
                faces.extend([(a,b,b+n),(b+n,a+n,a)])
    knobs = primitive("switchgear", pos, norm, [(0,0)]*len(pos), faces)
    return [block, knobs]


def classify(mesh, center, extent):
    x, y, z = center
    side = "turnL" if z < 0 else "turnR"
    if mesh == "SX_body":
        # Remove tiny nose and tail marque emblems and plate backing.
        if (x < -2.06 and abs(z) < .12 and extent[2] < .18) or (x > 1.99 and abs(z) < .02 and extent[1] < .02):
            return None
        return "Shell", "paint"
    if mesh == "SX_glass":
        if x > 1.62:
            return "Shell", "brake" if abs(z) > .25 or abs(z) < .05 else side
        if x < -1.62:
            return "Shell", side if .06 < y < .2 else "lens"
        return "Shell", "glass"
    if mesh == "SX_exterior":
        if abs(x+.18)<.05 and abs(y+.53)<.045 and extent[2]>.17 and extent[2]<.3:
            return "Shell", "mirror"
        # Paintable lamp housings retain their baked projector optics under the clear lenses.
        if -1.88 < x < -1.77 and y < .085 and abs(z) > .46 and extent[2] < .1:
            return "Shell", "head"
        if x < -1.77 and y > .2 and abs(z) > .67 and extent[2] < .1:
            return "Shell", "head"
        if 1.78 < x < 1.96 and -.32 < y < -.06 and abs(z) > .39:
            return "Shell", "taillamp-housing"
        if x > 1.9 and y < -.36 and extent[2] > .5:
            return "Shell", "wing"
        return "Shell", "exterior"
    if mesh == "SX_interior":
        # The original three-spoke wheel is one welded island. Its separately modeled
        # thumb controls and spoke inserts sit just behind the rim plane.
        wheel = np.array([-.225, -.195, -.34])
        if (abs(x-wheel[0]) < .063 and np.linalg.norm(center[1:]-wheel[1:]) < .17
                and extent[0] < .19 and extent[2] < .39):
            return "Steering", "leather"
        if abs(z) > .27 and .30 < x < .62 and extent[1] > .2:
            return "Shell", "seats"
        return "Shell", "interior"
    if mesh == "SX_wheel":
        if extent[1] > .62:
            return "Wheel", "tire"
        if .30 < extent[1] < .36:
            return "Wheel", "disc"
        if extent[1] > .36:
            return "Wheel", "rim"
        if extent[1] < .07 and extent[0] < .0004:
            return None
        return "Wheel", "hardware"
    raise ValueError(mesh)


def build(source_dir, output):
    gltf = Gltf()
    paint = gltf.texture(source_dir / "SX_body00_red.png", .85)
    exterior = gltf.texture(source_dir / "SX_exterior.png", .8, 4)
    interior = gltf.texture(source_dir / "SX_interior.png", .70, 6)
    wheel = gltf.texture(source_dir / "SX_wheel.png", .86, 6)
    gltf.material("paint", [.51, .09, .055, 1], .76, .23, paint, 1)
    gltf.material("exterior", [.36, .39, .43, 1], .30, .35, exterior)
    gltf.material("wing", [.39, .43, .48, 1], .57, .24, exterior, .33)
    gltf.material("interior", [.26, .29, .31, 1], .02, .84, interior)
    gltf.material("seats", [.40, .19, .085, 1], .02, .76, interior)
    gltf.material("leather", [.19, .18, .17, 1], .04, .67, interior)
    gltf.material("console-trim", [1, 1, 1, 1], .08, .67, gltf.image_texture(console_face(), "Vent controls"))
    gltf.material("switchgear", [.038,.039,.04,1], .62, .37)
    gltf.material("mirror", [.7,.77,.8,1], .96, .055)
    gltf.material("brake", [.50, .018, .009, .64], .18, .20, blend=True)
    gltf.material("taillamp-housing", [.92, .72, .71, 1], .35, .22, exterior)
    gltf.material("head", [.81, .88, 1, 1], .48, .13)
    gltf.material("turnL", [.78, .33, .035, .78], .13, .25, blend=True)
    gltf.material("turnR", [.78, .33, .035, .78], .13, .25, blend=True)
    gltf.material("lens", [.31, .36, .40, .13], .09, .12, blend=True)
    gltf.material("glass", [.34, .44, .50, .24], .18, .12, blend=True)
    gltf.material("tire", [.26, .27, .28, 1], .015, .9, wheel)
    gltf.material("disc", [.92, .94, .96, 1], .75, .4, wheel)
    gltf.material("rim", [.52, .54, .57, 1], .86, .26)
    gltf.material("hardware", [.27, .29, .31, 1], .8, .25)
    parts = defaultdict(list)
    steering = np.array([-.34, .625+.195, -.225])
    for filename in ("body", "glass", "interior", "wheel"):
        for surface in read_mesh(source_dir / f"SX_{filename}.mesh"):
            groups = defaultdict(list)
            for triangles in components(surface):
                pts = surface.pos[surface.faces[triangles].ravel()]
                lower, upper = pts.min(0), pts.max(0)
                group = classify(surface.name, (lower+upper)*.5, upper-lower)
                if group:
                    groups[group].append(triangles)
            for (part, material), selections in groups.items():
                matrix, offset = (IDENTITY, np.zeros(3)) if part == "Wheel" else (CHASSIS, FLOOR)
                if part == "Steering":
                    offset = offset - steering
                tri = np.concatenate(selections)
                primitive = gltf.primitive(surface, tri, material, matrix, offset)
                parts[part].append(primitive)
    assert all(parts[p] for p in ["Shell", "Wheel", "Steering"])
    parts["Shell"].extend(console_geometry(gltf))
    def mesh(part):
        return gltf.push("meshes", {"name": part+"Mesh", "primitives": parts[part]})
    gltf.root("Shell", mesh=mesh("Shell"))
    gltf.root("Steering", mesh=mesh("Steering"), translation=steering.tolist())
    wheels = mesh("Wheel")
    for name, x, z in (("FL", -.80, -1.275), ("FR", .80, -1.275), ("RL", -.80, 1.275), ("RR", .80, 1.275)):
        child = gltf.node(name+"Alloy", mesh=wheels, rotation=[0, 1, 0, 0] if x > 0 else [0, 0, 0, 1])
        gltf.root(name, children=[child], translation=[x, .33, z])
    gltf.write(output)
    print(f"Wrote {output} ({output.stat().st_size:,} bytes).")


if __name__ == "__main__" and "--inspect" in sys.argv:
    for p in sorted(Path(sys.argv[1]).glob("*.mesh")):
        for s in read_mesh(p):
            print(p.name, s.name, len(s.faces), np.round(s.pos.min(axis=0), 3), np.round(s.pos.max(axis=0), 3))
            indexed = sorted(components(s), key=len, reverse=True)
            for i, group in enumerate(indexed[:65]):
                pos = s.pos[s.faces[group].ravel()]
                print(i, len(group), "center", np.round((pos.min(0)+pos.max(0))*.5, 3), "size", np.round(np.ptp(pos, axis=0), 3))
elif __name__ == "__main__":
    base = Path(__file__).resolve().parent.parent
    build(Path(sys.argv[1]), base / "public/assets/licensed/kuroda-rs/car.glb")
