import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'tests/browser',workers:1,timeout:150000,expect:{timeout:20000},
  outputDir:'.qa/results',
  use:{
    baseURL:process.env.COASTLINE_TEST_URL??'http://127.0.0.1:5188',
    channel:process.env.COASTLINE_BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined),
    viewport:{width:1366,height:768},
    launchOptions:{args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']},
    screenshot:'only-on-failure',trace:'retain-on-failure',
  },
  webServer:process.env.COASTLINE_TEST_URL?undefined:{
    command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5188 --strictPort',
    url:'http://127.0.0.1:5188',reuseExistingServer:true,timeout:45000,
  },
});
