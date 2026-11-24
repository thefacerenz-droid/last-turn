# Coastline Motor Club

A single-player highway driving game built with TypeScript, Three.js, Rapier 3D, Vite and Web Audio. Drive three continuously streamed highways, tune 11 cars, and score clean passes through moving traffic. Assets, fonts, physics and audio run locally in the browser after loading.

## Run

Use a current desktop browser with WebGL 2 and hardware acceleration. Install Node.js 22.13 or newer and pnpm 11.25.0. From this directory run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. Choose **Garage** to select or tune a car, **Map select** for the highway, and **Session setup** for lighting and traffic. **Start driving** begins the simulation and enables audio.

## Drive

| Action | Keyboard | Standard controller |
| --- | --- | --- |
| Accelerate and brake | W and S, or up and down arrows | Right and left triggers |
| Steer | A and D, or left and right arrows | Left stick |
| Handbrake | Space | X / west face button |
| Manual downshift and upshift | Q and E | Left and right shoulder buttons |
| Manual clutch | Hold Shift | Hold A / south face button |
| Camera | C | Y / north face button |
| Look around | V, then drag | Right stick, or click left stick for free look |
| Reset the car | R | View / Select |
| Pause | Esc | Menu / Start |
| Headlights and diagnostics | L and F3 | Available through keyboard or settings as applicable |
| Left and right indicators | Z and X | D-pad left and right |

In automatic, brake to a stop and keep the brake held to engage reverse. In manual, shift down through neutral into reverse while stopped. Disabling automatic clutch requires pressing the clutch to change gear. The pause menu freezes the offline session. Driver settings, per-car tunes and the 15 highest-scoring runs persist in this browser. Save points include pause, periodic checkpoints, menu return and page exit.

## Build and deploy

```sh
pnpm run build
pnpm run preview
```

The build type-checks the application and produces a self-contained static site in `dist/`. On Vercel, import the project, choose `coastline` as the root directory if importing its parent, and use the included `vercel.json`. It selects Vite, the project build script and the `dist` output. The game requires no API keys, database or server functions. Other static hosts can serve the same directory at the site root. [Vercel Vite documentation](https://vercel.com/docs/frameworks/frontend/vite)

## Verify

```sh
pnpm test
pnpm run test:browser
```

The browser suite starts a loopback Vite server if needed. On Windows it uses installed Microsoft Edge. On other platforms install Chromium with `pnpm exec playwright install chromium`. To select another installed channel, set `COASTLINE_BROWSER_CHANNEL`. To test a production preview, point `COASTLINE_TEST_URL` at its origin. Screenshots and traces from the suite go under `.qa/`.

Press **F3** during a drive to inspect measured frame time, physics step time, active and physical traffic counts, suspension compression, tire slip, RPM, draw calls and triangle counts.

## Source

| Module | Responsibility |
| --- | --- |
| `src/core` | Session lifecycle, fixed-step accumulator, interpolation and transitions |
| `src/physics` | Rapier chassis, streamed ground and wall colliders, four suspension rays, tires, clutch, engine and transmission |
| `src/traffic` | Per-lane neighbor index, IDM following, lane-change incentives, physical contact and recovery |
| `src/world` | Deterministic route alignment and ramps, streamed scenery, vegetation LODs, signs and night lighting |
| `src/vehicles` | Car specifications, GLB loading, factory wheels, materials, lights and tuning |
| `src/rendering` and `src/camera` | Live showroom, HDR lighting, scene reflections, shadows, postprocessing and six camera modes |
| `src/input`, `src/audio`, `src/scoring` | Keyboard/gamepad input, real-time engine and road synthesis, clean passes, streaks and records |
| `src/settings` and `src/ui` | Saved preferences, HTML menus, map display and telemetry |

The physics runs at 60 Hz. Springs, dampers and anti-roll forces act at the four wheel contact patches. Tire forces share the available friction between acceleration and cornering. The engine exchanges torque with the driven wheels through the clutch, selected ratio and final drive. Near traffic uses dynamic rigid bodies with CCD. Distant traffic retains its lane and speed simulation and uses cheaper visual models.

## Assets and fidelity

The detailed Aurelia CX adapts the licensed Khronos Car Concept. The other ten selectable cars and six additional civilian models are original mesh designs with shared construction techniques, per-design profiles, mechanical specifications and separate wheel assemblies. They have simpler panel work and interiors than the licensed hero model. Garage performance figures are fictional design specifications. Road grade, tire slip, gearing and driver inputs affect measured acceleration and top speed.

The showroom combines a generated coastal backdrop with a live 3D vehicle, orbit camera and real shadows. The highways, traffic and roadside scenery render in 3D during play. Engine, traffic and tire audio use real-time synthesis. The collision system models rigid impacts and loss of control. Cosmetic body deformation is outside this release.

The [asset manifest](ASSETS.md) gives sources, licensing, paths and rebuild commands. Prebuilt assets are included. Python is needed only to rebuild the adapted Khronos mesh.
