# Last Exit

A single-player highway driving game built with TypeScript, Three.js, Rapier 3D, Vite and Web Audio. Drive three continuously streamed highways, tune 12 cars, and score clean passes through moving traffic. Assets, fonts, physics and audio run locally in the browser after loading.

## Run

Use a current hardware-accelerated browser with WebGL 2. For local development, install Node.js 22.13 or newer and pnpm 11.25.0. From this directory run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. Choose **Garage** to select or tune a car. Tap its name to open the full vehicle list, or use the previous and next buttons. Switch between **Exterior** and **Cockpit** and drag to inspect. Choose **Routes** for the highway or **Session setup** for lighting and traffic. **Drive** starts the simulation and enables audio.

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

On phones, hold a steering arrow with your left thumb and Gas or Brake with your right. The camera and reset buttons are at the top of the screen. Manual mode adds gear buttons and, when automatic clutch is disabled, a clutch button. Both portrait and landscape work. The first visit on a phone uses Low graphics and Low traffic. **Settings → Driving → Touch controls** lets you show or hide the buttons on hybrid devices.

## Build and deploy

```sh
pnpm run build
pnpm run preview
```

The build type-checks the application and writes the static site to `dist/`. The Render static site **last-exit** tracks the `main` branch of `thefacerenz-droid/last-turn` with the project at the repository root. The included `render.yaml` carries the build and publish settings for a fresh deployment. [Play Last Exit](https://last-exit.onrender.com/) · [Render static sites](https://render.com/docs/static-sites)

For Vercel, import the repository using its root directory and the included `vercel.json`. It selects Vite, the project build script and the `dist` output. The game requires no API keys, database or server functions. [Vercel Vite documentation](https://vercel.com/docs/frameworks/frontend/vite)

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
| `src/input`, `src/audio`, `src/scoring` | Keyboard, standard gamepad and multi-touch input, sampled engine playback and synthesized road effects, clean passes, streaks and records |
| `src/settings` and `src/ui` | Saved preferences, HTML menus, map display and telemetry |

The physics runs at 60 Hz. Springs, dampers and anti-roll forces act at the four wheel contact patches. Tire forces share the available friction between acceleration and cornering. The engine exchanges torque with the driven wheels through the clutch, selected ratio and final drive. Near traffic uses dynamic rigid bodies with CCD. Distant traffic retains its lane and speed simulation and uses cheaper visual models.

## Assets and fidelity

The Kuroda RS Club adapts a licensed wide-body coupe and modeled interior by Socksthecat, with game meshes and textures prepared by CryHam. The center-seat Aurelia CX adapts the licensed Khronos Car Concept. The ten other sports cars use original bodies and cockpits, with model-specific seats, steering wheels, controls and instruments. The original designs have simpler bodywork than the two licensed models. Garage performance figures are fictional design specifications. Road grade, tire slip, gearing and driver inputs affect measured acceleration and top speed.

The showroom combines a generated coastal backdrop with a live 3D vehicle, orbit camera and real shadows. The highways, traffic and roadside scenery render in 3D during play. Player engines blend licensed real-car recordings by RPM and throttle. Traffic and tire effects use real-time synthesis. The collision system models rigid impacts and loss of control. Cosmetic body deformation is outside this release.

The renderer uses WebGL 2, a configurable frame cap, browser-managed display synchronization and atmospheric fog. Native WebGPU, ray-marched volumetrics and block-compressed GPU textures are outside this release. Actual performance depends on resolution, graphics settings and the device.

Prebuilt models are included. Python is needed only to rebuild the two licensed meshes. The manifest gives all sources and instructions. Credits are also available under Controls in the game. [Asset manifest](ASSETS.md)
