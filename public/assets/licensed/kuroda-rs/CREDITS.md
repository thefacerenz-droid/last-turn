# Kuroda RS Club

The car body, cabin and wheels in `car.glb` are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- Socksthecat modeled the body and cockpit for *Subaru BRZ Varis*. [Original model and license](https://sketchfab.com/3d-models/subaru-brz-varis-8fecd93279644ada9111c5bfa2226327)
- Socksthecat modeled the wheel used in this adaptation for *Nissan Silvia S15 Custom*. [Original model and license](https://sketchfab.com/3d-models/nissan-silvia-s15-custom-2c3481e502c24d818d23a5eb2be8dac9)
- CryHam prepared Stunt Rally's SX adaptation, including the UV unwrap, baked shading, wheel modifications and game meshes. [Upstream credits](https://github.com/stuntrally/stuntrally/blob/9a7efa5aea7f792f88220d75a6e0d9e22c8ea6e6/data/cars/SX/about.txt) · [Editable Blender sources](https://github.com/stuntrally/blendfiles/tree/master/cars/SX)

This game adapts the meshes for a fictional rear-wheel-drive club coupe. The conversion sets meter-scale wheel and steering pivots, groups the bodywork, seats, headlamps, brake lights and indicators, removes small exterior badges, and creates physically based materials from the baked surface textures. The included GLB shares the source license. The fictional name and tuning belong to this game adaptation.

## Rebuilding the asset

The game loads the shipped GLB directly. To rebuild it, download the four `SX_*.mesh` files and the four named PNGs from the [pinned source directory](https://github.com/stuntrally/stuntrally/tree/9a7efa5aea7f792f88220d75a6e0d9e22c8ea6e6/data/cars/SX). Put `SX_body.mesh`, `SX_glass.mesh`, `SX_interior.mesh`, `SX_wheel.mesh`, `SX_body00_red.png`, `SX_exterior.png`, `SX_interior.png`, and `SX_wheel.png` in one directory. In a Python environment with NumPy and Pillow, run this at the repository root.

```sh
python scripts/adapt-clubsport.py /path/to/sx
```
