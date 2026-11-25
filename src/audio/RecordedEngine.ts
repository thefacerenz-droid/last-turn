import { clamp } from '../core/math';

type Pack = 'gt3rs' | '765lt' | 'sto';
type Loop = { rpm: number; source: AudioBufferSourceNode; gain: GainNode };
const anchors = {
  gt3rs: [[2000, 4000, 7000], [3000, 6000]],
  '765lt': [[1000, 4000, 7000], [3000, 6000]],
  sto: [[2000, 4000, 7000], []]
};

export class RecordedEngine {
  private pack?: Pack;
  private layers: Loop[][] = [];
  private cache = new Map<string, Promise<AudioBuffer>>();
  private filter: BiquadFilterNode;
  constructor(private ctx: AudioContext, output: AudioNode) {
    this.filter = ctx.createBiquadFilter();
    this.filter.Q.value = 0.65;
    this.filter.connect(output);
  }

  private buffer(path: string) {
    let pending = this.cache.get(path);
    if (!pending) {
      pending = fetch(path).then(async response => {
        if (!response.ok) throw new Error(path);
        return this.ctx.decodeAudioData(await response.arrayBuffer());
      });
      this.cache.set(path, pending);
      pending.catch(() => this.cache.delete(path));
    }
    return pending;
  }

  private async select(pack: Pack) {
    this.pack = pack;
    for (const layer of this.layers) for (const { source, gain } of layer) {
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    this.layers = [];
    const banks = await Promise.all(anchors[pack].map((rpms, index) =>
      Promise.all(rpms.map(async rpm => ({
        rpm, buffer: await this.buffer('/assets/audio/' + pack + '/' + (index ? 'off_' : 'on_') + rpm + '.wav')
      })))
    ));
    if (this.pack !== pack || this.layers.length) return;
    this.layers = banks.map(bank => bank.map(({ rpm, buffer }) => {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(this.filter);
      source.start();
      return { rpm, source, gain };
    }));
  }

  update(cylinders: number, rpm: number, throttle: number, shifting: boolean, cockpit: boolean) {
    const pack = cylinders >= 10 ? 'sto' : cylinders >= 8 ? '765lt' : 'gt3rs';
    if (pack !== this.pack) void this.select(pack).catch(() => {});
    if (!this.layers.length) return false;
    const now = this.ctx.currentTime;
    const load = shifting ? 0.06 : throttle;
    const pitch = rpm * (cylinders === 4 ? 0.82 : 1);
    const overrun = this.layers[1].length ? clamp((rpm - 1250) / 1300, 0, 1) * (1 - load) : 0;
    this.filter.frequency.setTargetAtTime((cockpit ? 2300 : 6000) * (0.52 + load * 0.48), now, 0.055);
    this.layers.forEach((layer, index) => {
      const level = index ? Math.sqrt(overrun) * 0.76 : Math.sqrt(1 - overrun) * (0.55 + 0.45 * load);
      layer.forEach(({ source, gain, rpm: anchor }, i) => {
        const neighbor = pitch < anchor ? layer[i - 1] : layer[i + 1];
        const fraction = neighbor ? clamp(Math.log(pitch / anchor) / Math.log(neighbor.rpm / anchor), 0, 1) : 0;
        gain.gain.setTargetAtTime(level * Math.cos(fraction * Math.PI / 2), now, 0.035);
        source.playbackRate.setTargetAtTime(clamp(pitch / anchor, 0.3, 2.4), now, 0.022);
      });
    });
    return true;
  }
}
