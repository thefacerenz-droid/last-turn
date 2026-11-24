"""Bake the licensed Khronos concept car into the runtime's ground-centred wheel rig.

Usage: python scripts/adapt-concept.py /path/to/CarConcept.glb
Requires NumPy. The shipped game only needs the output GLB.
"""
import json
import struct
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

source = Path(sys.argv[1]).read_bytes()
json_size = struct.unpack_from("<I", source, 12)[0]
doc = json.loads(source[20:20+json_size])
buffer = source[28+json_size:]
types = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
sizes = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def read(index):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    dtype = np.dtype(types[accessor["componentType"]])
    n = sizes[accessor["type"]]
    return np.ndarray((accessor["count"], n), dtype, buffer,
                      offset=view.get("byteOffset", 0)+accessor.get("byteOffset", 0),
                      strides=(view.get("byteStride", n*dtype.itemsize), dtype.itemsize))

def transform(n):
    if "matrix" in n:
        return np.array(n["matrix"]).reshape(4, 4).T
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    m = np.eye(4)
    m[:3, :3] = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                           [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                           [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag(n.get("scale", [1,1,1]))
    m[:3, 3] = n.get("translation", [0,0,0])
    return m

wheel_names = {"WheelFrontL":"FL", "WheelFrontR":"FR", "WheelRearL":"RL", "WheelRearR":"RR"}
pieces = []
wheel_centres = {}
def visit(index, parent, part="Shell", straight=None):
    node = doc["nodes"][index]
    name = node.get("name", "")
    matrix = parent @ transform(node)
    if name in wheel_names:
        part = wheel_names[name]
        wheel_centres[part] = matrix[:3,3].copy()
        axis=matrix[:3,0]
        angle=(np.arctan2(axis[2],axis[0])+np.pi/2)%np.pi-np.pi/2
        co,si=np.cos(angle),np.sin(angle)
        straight=np.array([[co,0,si],[0,1,0],[-si,0,co]])
    if name.startswith("InteriorSteeringWheel") or name in ("InteriorSteeringHandleL","InteriorSteeringHandleR"):
        part="Steering"
    if "mesh" in node and name not in ("License Plate", "InteriorSteeringEmblem"):
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            attrs = primitive["attributes"]
            pos = read(attrs["POSITION"]).astype(float) @ matrix[:3,:3].T + matrix[:3,3]
            norm = read(attrs["NORMAL"]).astype(float) @ np.linalg.inv(matrix[:3,:3])
            if straight is not None:
                pos=(pos-wheel_centres[part]) @ straight.T+wheel_centres[part]
                norm=norm @ straight.T
            indices=read(primitive["indices"]).reshape(-1).astype(np.int32)
            mat=primitive["material"]
            pieces.append((part,mat,pos,norm,indices))
    for child in node.get("children", []):
        visit(child,matrix,part,straight)

for node in doc["scenes"][0]["nodes"]:
    visit(node,np.diag([-1.,1.,-1.,1.]))
allpos=np.concatenate([p[2] for p in pieces])
lo,hi=allpos.min(axis=0),allpos.max(axis=0)
scale=4.65/(hi[2]-lo[2])
mid=(wheel_centres["FL"]+wheel_centres["RR"]+wheel_centres["FR"]+wheel_centres["RL"])/4
mid[1]=lo[1]
origin={k:(v-mid)*scale for k,v in wheel_centres.items()}
origin["Steering"]=(np.concatenate([p[2] for p in pieces if p[0]=="Steering"]).mean(axis=0)-mid)*scale
origin["Shell"]=np.zeros(3)
for centre in origin.values():
    centre[0]*=.86
materials=[
 ("trim",[.022,.027,.03],.38,.42),("glass",[.19,.28,.31],.17,.1),("seal",[.013,.015,.015],.08,.47),
 ("interior",[.026,.029,.029],.12,.75),("floor",[.018,.018,.017],0,.9),("alloy",[.45,.46,.46],.88,.26),
 ("leather",[.17,.089,.049],.03,.58),("seat",[.07,.073,.064],.03,.61),("dash",[.028,.031,.031],.13,.42),
 ("plate",[.3,.28,.2],.23,.4),("accent",[.068,.080,.083],.79,.23),("paint",[.53,.60,.63],.84,.20),
 ("signal",[.54,.22,.042],.1,.21),("brake",[.43,.013,.009],.12,.21),("head",[.77,.88,.92],.56,.13),
 ("mirror",[.76,.81,.83],.97,.055),("caliper",[.46,.052,.018],.49,.29),("disc",[.22,.23,.23],.88,.42),
 ("sidewall",[.023,.024,.024],.02,.76),("tread",[.017,.018,.019],0,.83),("rim",[.38,.42,.44],.91,.23),("rimDark",[.065,.075,.082],.85,.24),
 ("turnL",[.52,.19,.029],.12,.22),("turnR",[.52,.19,.029],.12,.22)]
out={"asset":{"version":"2.0","copyright":"Adapted from Car Concept by Eric Chadwick, DGG (2024), CC BY 4.0. See CREDITS.md."},"scene":0,"scenes":[{"nodes":[]}],"nodes":[],"meshes":[],"accessors":[],"bufferViews":[],"buffers":[{}],"materials":[]}
for name,c,metal,rough in materials:
    m={"name":name,"pbrMetallicRoughness":{"baseColorFactor":c+[.40 if name=="glass" else 1],"metallicFactor":metal,"roughnessFactor":rough}}
    if name=="glass":m.update(alphaMode="BLEND",doubleSided=True)
    out["materials"].append(m)
binary=bytearray()
def array(a,kind,component,dtype,normalized=False):
    a=np.ascontiguousarray(a,dtype=dtype)
    binary.extend(bytes((-len(binary))%4))
    out["bufferViews"].append({"buffer":0,"byteOffset":len(binary),"byteLength":a.nbytes})
    binary.extend(a.tobytes())
    acc={"bufferView":len(out["bufferViews"])-1,"componentType":component,"type":kind,"count":len(a)}
    if normalized:acc["normalized"]=True
    if component==5126:acc.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
    out["accessors"].append(acc)
    return len(out["accessors"])-1
groups=defaultdict(list)
for part,mat,pos,norm,idx in pieces:
    mat=mat if mat<len(materials) else 2
    local=(pos-mid)*scale
    local[:,0]*=.86
    local-=origin[part]
    norm[:,0]/=.86
    norm/=np.maximum(1e-10,np.linalg.norm(norm,axis=1,keepdims=True))
    if mat==12:
        faces=idx.reshape(-1,3)
        left=local[faces,0].mean(axis=1)<0
        for target,mask in ((22,left),(23,~left)):
            selected=faces[mask].reshape(-1)
            if len(selected):
                used,remap=np.unique(selected,return_inverse=True)
                groups[part,target].append((local[used],norm[used],remap))
    else:
        groups[part,mat].append((local,norm,idx))
for part in ["Shell","Steering","FL","FR","RL","RR"]:
    mesh={"name":part,"primitives":[]}
    for (group,mat),data in groups.items():
        if group!=part:continue
        pos=np.concatenate([p for p,n,i in data]);norm=np.concatenate([n for p,n,i in data])
        idx=np.concatenate([i+off for (p,n,i),off in zip(data,np.cumsum([0]+[len(p) for p,n,i in data[:-1]]))])
        prim={"attributes":{"POSITION":array(pos,"VEC3",5126,"<f4"),"NORMAL":array(norm,"VEC3",5126,"<f4")},
              "indices":array(idx,"SCALAR",5123 if len(pos)<65536 else 5125,"<u2" if len(pos)<65536 else "<u4"),"material":mat}
        mesh["primitives"].append(prim)
    node={"mesh":len(out["meshes"]),"name":part,"translation":origin[part].tolist()}
    out["scenes"][0]["nodes"].append(len(out["nodes"]));out["nodes"].append(node);out["meshes"].append(mesh)
binary.extend(bytes((-len(binary))%4));out["buffers"][0]["byteLength"]=len(binary)
header=json.dumps(out,separators=(",",":")).encode();header+=b" "*((-len(header))%4)
result=struct.pack("<4sII",b"glTF",2,28+len(header)+len(binary))+struct.pack("<I4s",len(header),b"JSON")+header+struct.pack("<I4s",len(binary),b"BIN\0")+binary
destination=Path(__file__).resolve().parents[1]/"public/assets/licensed"
destination.mkdir(parents=True,exist_ok=True)
(destination/"aurelia-cx.glb").write_bytes(result)
print("Length, width, height",4.65,(hi[0]-lo[0])*scale,(hi[1]-lo[1])*scale)
print("Wheel geometry", {k:v.round(3).tolist() for k,v in origin.items()})
print("GLB bytes",len(result))
