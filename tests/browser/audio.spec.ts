import { expect, test } from '@playwright/test';

test('the engine plays decoded recordings and tracks revs under throttle', async ({ page }) => {
  await page.addInitScript(() => {
    const voices: AudioBufferSourceNode[] = [];
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.loop && this.buffer && this.buffer.duration !== 2) voices.push(this);
      return original.apply(this, args);
    };
    Object.assign(window, { engineRates: () => voices.map(v => v.playbackRate.value) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start driving', exact: true }).click();
  const rates = () => page.evaluate(() => (window as unknown as { engineRates(): number[] }).engineRates());
  await expect.poll(async () => (await rates()).length).toBeGreaterThanOrEqual(3);
  const idle = (await rates())[0];
  await page.keyboard.down('w');
  await expect.poll(async () => (await rates())[0]).toBeGreaterThan(idle + 0.25);
  await page.keyboard.up('w');
});
