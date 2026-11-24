import { ROUTES, type Route, type RouteId } from '../world/roads';
import { densityCounts, type Settings } from '../settings/SettingsManager';
import type { RecordRun } from '../scoring/ScoringManager';
import { clockTime } from '../core/math';

const paths = {
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="m3.7 9.5 6.5 1.7m10.1-1.7-6.5 1.7M11 14l1 7 1-7"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H3v2a4 4 0 0 0 4.6 4m9.4-6h4v2a4 4 0 0 1-4.6 4M12 14v4m-5 3h10m-8-3h6v3"/>',
  gamepad: '<path d="M7 6h10c2.1 0 3.4 1.9 3.9 4.5l.9 5.2c.5 3-2 4.4-4.1 2.3l-2.4-2.4H8.7L6.3 18c-2.1 2.1-4.6.7-4.1-2.3l.9-5.2C3.6 7.9 4.9 6 7 6zM7 9v4m-2-2h4"/><circle cx="16" cy="10" r=".65"/><circle cx="18.3" cy="12.1" r=".65"/>',
  volume: '<path d="M11 4 6 8H3v8h3l5 4zM15 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>',
  muted: '<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  layers: '<path d="m3 16 9-5 9 5m-18-5 9-5 9 5m-18 10 9-5 9 5"/>',
  camera: '<path d="M3 7h4l1.5-2h7L17 7h4v12H3z"/><circle cx="12" cy="13" r="3"/>',
  pause: '<path stroke-width="3" d="M8 5v14m8-14v14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  left: '<path d="m14 5-7 7 7 7"/>',
  right: '<path d="m10 5 7 7-7 7"/>',
  flag: '<path d="M5 21V4c4-3 8 3 14 0v10c-6 3-10-3-14 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  moon: '<path d="M20.6 15.6A9 9 0 0 1 8.4 3.4a9 9 0 1 0 12.2 12.2z"/>',
  road: '<path d="m4 21 5-18m6 0 5 18M12 3v3m0 4v4m0 4v3"/>',
  settings: '<path d="M3 7h5m4 0h9M3 17h9m4 0h5"/><circle cx="10" cy="7" r="2"/><circle cx="14" cy="17" r="2"/>',
};
export function icon(name: keyof typeof paths, size = 20) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

const scenes = {
  pacific: { words: ['Pacific', 'Coast'], time: 'Golden hour', light: 'golden', description: 'Thread the traffic along sunlit bluffs and sweeping ocean bends.' },
  marina: { words: ['Marina', 'Expressway'], time: 'Blue hour', light: 'evening', description: 'Slip past traffic under dockside cranes and the lights of Port Alondra.' },
  mesa: { words: ['Sierra', 'Pass'], time: 'Afternoon', light: 'afternoon', description: 'Carry your speed through a sunbaked canyon of wide, winding straights.' },
} as const;

export const lightingFor = (route: RouteId) => scenes[route].light;
export const getRoute = (id: RouteId) => ROUTES.find(route => route.id === id)!;
export const speedValue = (mps: number, unit: Settings['unit']) => Math.round(Math.abs(mps) * (unit === 'MPH' ? 2.23694 : 3.6));
export const distanceValue = (metres: number, unit: Settings['unit']) => (metres / (unit === 'MPH' ? 1609.344 : 1000)).toFixed(2) + (unit === 'MPH' ? ' mi' : ' km');
export const pts = (n: number) => Math.floor(n).toLocaleString('en-US');
const brand = `<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-type">Coastline<small>Motor Club</small></span>`;
const options = (values: string[], selected: string) => values.map(v => `<option${v === selected ? ' selected' : ''}>${v}</option>`).join('');
export const soundAction = (muted: boolean) => `<button class="icon-btn" data-action="sound" aria-label="${muted ? 'Turn sound on' : 'Mute sound'}" title="${muted ? 'Turn sound on' : 'Mute sound'}">${icon(muted ? 'muted' : 'volume', 19)}</button>`;

function routeCard(route: Route, selected: boolean) {
  return `<button type="button" class="route-card${selected ? ' selected' : ''}" data-route="${route.id}" aria-label="${route.name}, ${route.lanes} lanes" aria-pressed="${selected}">
    <img src="/art/${route.id}-thumb.webp" alt="" width="432" height="243">
    <span class="card-text"><small>HWY ${route.shield}</small><strong>${route.name}</strong></span>
    <span class="card-indicator" aria-hidden="true">${selected ? icon('check', 13) : icon('right', 14)}</span>
  </button>`;
}

export function garage(settings: Settings, best: number) {
  const route = getRoute(settings.route), scene = scenes[route.id];
  const timeIcon = route.id === 'marina' ? 'moon' : 'sun';
  return `<div class="garage">
    <header class="masthead">
      <div class="brand" aria-label="Coastline Motor Club">${brand}</div>
      <nav aria-label="Main navigation" class="main-nav">
        <button data-action="drive" aria-current="page">${icon('wheel', 17)}Drive</button>
        <button data-action="records">${icon('trophy', 16)}Records</button>
      </nav>
      <div class="tools">${soundAction(settings.muted)}<span class="tool-rule"></span><button class="controls-button" data-action="controls" aria-label="Controls and settings">${icon('gamepad', 20)}<span>Controls</span></button></div>
    </header>
    <section class="hero" aria-labelledby="route-title">
      <img class="hero-art" src="/art/${route.id}.webp" alt="" width="1672" height="941" fetchpriority="high">
      <div class="hero-shade"></div>
      <div class="hero-copy">
        <div class="location"><span class="accent-line"></span>${icon('pin', 14)}${route.district}</div>
        <h1 id="route-title" class="${route.id === 'marina' ? 'long-title' : ''}"><span>${scene.words[0]}</span><span>${scene.words[1]}</span></h1>
        <div class="route-meta"><span>${icon(timeIcon, 16)}${scene.time}</span><i></i><span>${icon('road', 16)}${route.lanes} lanes</span></div>
        <p class="hero-description">${scene.description}</p>
        <div class="launch-row"><button class="primary start" data-action="start">Start run ${icon('arrow', 22)}</button>
          <div class="best">${icon('trophy', 20)}<div><small>Personal best</small><strong>${pts(best)} <em>PTS</em></strong></div></div>
        </div>
      </div>
      <div class="car-caption"><span class="caption-line"></span><span><small>Driver's car</small><strong>Vesper GT</strong></span><span class="car-specs">480 HP<br>AWD</span></div>
    </section>
    <section class="route-tray" aria-labelledby="routes-title">
      <div class="tray-top"><h2 id="routes-title">Select route</h2><label class="density">${icon('settings', 15)}<span>Traffic</span><span class="select-wrap"><select id="traffic" aria-label="Traffic density">${options(Object.keys(densityCounts).concat(settings.density === 'Custom' ? ['Custom'] : []), settings.density)}</select>${icon('chevron', 13)}</span></label></div>
      <div class="route-list">${ROUTES.map(r => routeCard(r, r.id === route.id)).join('')}</div>
    </section>
  </div>`;
}

export function hud(route: Route, muted: boolean) {
  return `<div class="hud">
    <div class="hud-top"><div class="hud-route"><span class="highway-shield">${route.shield}</span><span><small>Free drive</small><b>${route.name}</b></span></div>
    <div class="hud-actions">${soundAction(muted)}<button class="icon-btn" data-action="camera" aria-label="Change camera" title="Change camera (C)">${icon('camera')}</button><button class="icon-btn" data-action="pause" aria-label="Pause run" title="Pause (Esc)">${icon('pause')}</button></div></div>
    <div class="hud-score"><small>Score</small><div><strong id="score">0</strong><span id="combo">×1</span></div></div>
    <div class="pass-event" id="event" role="status" aria-live="polite"></div>
    <div class="drive-hint" id="drive-hint"><span class="key-hint"><kbd>W</kbd> Accelerate <kbd>A</kbd><kbd>D</kbd> Steer</span><span class="touch-hint">Hold gas to accelerate</span><span class="hint-rule"></span>Chain close passes for points</div>
    <div class="trip"><span><small>Distance</small><b id="distance">0.00 mi</b></span><span><small>Time</small><b id="time">00:00</b></span></div>
    <div class="speedometer"><div class="speed-row"><span class="gear"><small>GEAR</small><b id="gear">1</b></span><strong id="speed">0</strong><small id="unit">MPH</small></div><div class="rev-track"><div id="revs"></div></div></div>
    <div class="touch-pad"><div class="touch-steer"><button data-hold="left" aria-label="Steer left">${icon('left', 26)}</button><button data-hold="right" aria-label="Steer right">${icon('right', 26)}</button></div><div class="touch-pedals"><button data-hold="brake" aria-label="Brake">Brake</button><button data-hold="throttle" aria-label="Accelerate">Gas</button></div></div>
  </div>`;
}

export type Sheet = 'controls' | 'settings' | 'records' | 'pause' | 'results' | 'error';
export const modalHead = (eyebrow: string, title: string, close = true) => `<div class="panel-head"><div><span class="eyebrow"><i></i>${eyebrow}</span><h2 id="panel-title">${title}</h2></div>${close ? `<button data-action="close" class="icon-btn" aria-label="Close dialog">${icon('close')}</button>` : ''}</div>`;
const keys = (keyNames: string[]) => keyNames.map(k => `<kbd>${k}</kbd>`).join('');
export function helpSheet(settings: Settings, sheet: 'controls' | 'settings', playing: boolean) {
  const controls = [
    ['Accelerate / brake', ['W', 'S'], ['↑', '↓']], ['Steer', ['A', 'D'], ['←', '→']], ['Handbrake', ['Space']], ['Camera', ['C']], ['Recover car', ['R']], ['Pause', ['Esc']],
  ] as [string, string[], string[]?][];
  return `${modalHead('Motor club', 'Driver setup')}<div class="sheet-tabs"><button data-action="controls" aria-pressed="${sheet === 'controls'}">Controls</button><button data-action="settings" aria-pressed="${sheet === 'settings'}">Settings</button></div>
  ${sheet === 'controls' ? `<p class="sheet-intro">Pass close to traffic to score. Link overtakes within nine seconds to build your multiplier. A hard crash ends the run.</p>
    <dl class="controls-list">${controls.map(([label, a, b]) => `<div><dt>${label}</dt><dd>${keys(a)}${b ? `<em>or</em>${keys(b)}` : ''}</dd></div>`).join('')}</dl>
    <p class="touch-note">${icon('gamepad', 18)}Touch controls appear on touchscreens. A standard gamepad uses the left stick and triggers.</p>` :
    `<div class="settings-list"><label><span>Speed units</span><select data-pref="unit">${options(['MPH', 'KM/H'], settings.unit)}</select></label>
    <label><span>Graphics quality</span><select data-pref="preset">${options(['Low', 'Medium', 'High', 'Ultra'], settings.preset)}</select></label>
    <label><span>Engine sound</span><select data-pref="sound">${options(['On', 'Off'], settings.muted ? 'Off' : 'On')}</select></label></div>`}
    <button class="secondary panel-wide" data-action="close">${playing ? 'Back to pause menu' : 'Back to drive'} ${icon('arrow', 18)}</button>`;
}

export function recordsSheet(runs: RecordRun[], unit: Settings['unit']) {
  const rows = runs.slice(0, 8).map((r, i) => {
    const route = ROUTES.find(route => route.id === r.route);
    return `<li><span class="place">${String(i + 1).padStart(2, '0')}</span><div><b>${route?.name ?? 'Highway run'}</b><small>${distanceValue(r.distance, unit)} · ${clockTime(r.seconds)}</small></div><strong>${pts(r.score)} <small>PTS</small></strong></li>`;
  }).join('');
  return `${modalHead('Motor club', 'Run records')}${rows ? `<ol class="records">${rows}</ol>` : `<div class="empty-records">${icon('trophy', 34)}<h3>Your first run starts here.</h3><p>Finish a drive to save your score on this device.</p></div>`}<button class="primary panel-wide" data-action="close">Back to drive ${icon('arrow', 19)}</button>`;
}
