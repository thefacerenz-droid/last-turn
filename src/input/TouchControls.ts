import { icon } from '../ui/icons';
import type { Settings } from '../settings/SettingsManager';

type Held = 'left' | 'right' | 'gas' | 'brake' | 'handbrake' | 'clutch';
type Tap = 'camera' | 'reset' | 'up' | 'down' | 'pause';

/** Each finger owns its contact until it lifts or the OS cancels it. */
export class TouchControls {
  private contacts = new Map<number, HTMLButtonElement>();

  constructor(root: HTMLElement, private trigger: (action: Tap) => void) {
    root.addEventListener('pointerdown', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-hold],button[data-tap]');
      if (!button || event.button !== 0 || root.dataset.page!=='game') return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.contacts.set(event.pointerId, button);
      button.classList.add('pressed');
      // Secondary touches do not synthesize clicks. Shift immediately so the
      // clutch or throttle can stay depressed under the other thumb.
      if (button.dataset.tap) this.trigger(button.dataset.tap as Tap);
    });
    const release = (event: PointerEvent) => {
      const button = this.contacts.get(event.pointerId);
      if (!button) return;
      this.contacts.delete(event.pointerId);
      if (![...this.contacts.values()].includes(button)) button.classList.remove('pressed');
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('lostpointercapture', release);
    root.addEventListener('contextmenu', event => {
      if ((event.target as Element).closest('.touch-deck,.touch-tools')) event.preventDefault();
    });
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tap]');
      if (button && event.detail === 0) this.trigger(button.dataset.tap as Tap);
    });
  }

  held(control: Held) {
    for (const button of this.contacts.values()) if (button.dataset.hold === control) return 1;
    return 0;
  }

  clear() {
    for (const button of this.contacts.values()) button.classList.remove('pressed');
    this.contacts.clear();
  }
}

export function touchMarkup(settings: Settings) {
  const hold = (control: Held, label: string, content: string) =>
    `<button type="button" data-hold="${control}" aria-label="${label}">${content}</button>`;
  const tap = (action: Tap, label: string, content: string) =>
    `<button type="button" data-tap="${action}" aria-label="${label}" title="${label}">${content}</button>`;
  const manual = settings.mode === 'Manual';
  return `<div class="touch-tools">
    ${tap('camera','Change camera',icon('camera',20))}
    ${tap('reset','Reset vehicle',icon('rotate',19))}
  </div>
  <div class="touch-deck" role="group" aria-label="Driving controls">
    <div class="thumb-left">
      <div class="touch-aux">${hold('handbrake','Handbrake','Handbrake')}${manual && !settings.autoClutch ? hold('clutch','Hold clutch','Clutch') : ''}</div>
      <div class="thumb-steering">${hold('left','Steer left',icon('left',27))}${hold('right','Steer right',icon('right',27))}</div>
    </div>
    <div class="thumb-right">
      ${manual ? '<div class="touch-aux">'+tap('down','Downshift','Gear −')+tap('up','Upshift','Gear +')+'</div>' : ''}
      <div class="pedals">${hold('brake','Brake and reverse','<i></i><span>Brake</span>')}${hold('gas','Accelerate','<i></i><span>Gas</span>')}</div>
    </div>
  </div>`;
}
