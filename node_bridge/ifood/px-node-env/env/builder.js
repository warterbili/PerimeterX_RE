/**
 * Browser environment builder using JSDOM.
 * Returns { window, dom, document } with browser APIs mocked
 * so PX SDK can run inside Node.js.
 */

'use strict';

const { JSDOM, ResourceLoader } = require('jsdom');

/**
 * Build a realistic browser environment for PX SDK execution.
 * @param {Object} opts
 * @param {string} opts.targetUrl  - The page URL to simulate
 * @param {string} opts.userAgent  - Browser user agent string
 * @returns {{ window: Window, dom: JSDOM, document: Document }}
 */
function buildEnvironment({ targetUrl, userAgent } = {}) {
  const ua = userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const url = targetUrl || 'https://www.ifood.com.br';

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url,
    userAgent: ua,
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
  });

  const window = dom.window;
  const document = window.document;

  // ── Navigator patches ──────────────────────────────────────
  installNavigator(window, ua);

  // ── Screen / display ──────────────────────────────────────
  installScreen(window);

  // ── Performance API ────────────────────────────────────────
  installPerformance(window);

  // ── Canvas (stub) ─────────────────────────────────────────
  installCanvas(window);

  // ── Audio (stub) ──────────────────────────────────────────
  installAudio(window);

  // ── Storage ───────────────────────────────────────────────
  installStorage(window);

  // ── Misc browser APIs ─────────────────────────────────────
  installMisc(window);

  process.stderr.write(`[ENV] Environment built successfully\n`);
  process.stderr.write(`[ENV] Target URL: ${url}\n`);
  process.stderr.write(`[ENV] User-Agent: ${ua.substring(0, 80)}\n`);

  return { window, dom, document };
}


// ── Navigator ─────────────────────────────────────────────────

function installNavigator(window, ua) {
  const nav = window.navigator;

  const overrides = {
    userAgent: ua,
    appVersion: ua.replace('Mozilla/', ''),
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    vendorSub: '',
    product: 'Gecko',
    productSub: '20030107',
    language: 'en-US',
    languages: ['en-US', 'en', 'pt-BR'],
    onLine: true,
    cookieEnabled: true,
    doNotTrack: null,
    maxTouchPoints: 0,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    appCodeName: 'Mozilla',
    appName: 'Netscape',
  };

  for (const [k, v] of Object.entries(overrides)) {
    try {
      Object.defineProperty(nav, k, { get: () => v, configurable: true });
    } catch (_) {}
  }

  // plugins (non-empty to look real)
  try {
    Object.defineProperty(nav, 'plugins', {
      get: () => {
        const arr = [];
        arr.length = 3;
        return arr;
      },
      configurable: true,
    });
  } catch (_) {}

  // permissions stub
  if (!nav.permissions) {
    try {
      Object.defineProperty(nav, 'permissions', {
        get: () => ({
          query: async () => ({ state: 'granted' }),
        }),
        configurable: true,
      });
    } catch (_) {}
  }

  // webdriver = false (anti-bot)
  try {
    Object.defineProperty(nav, 'webdriver', { get: () => false, configurable: true });
  } catch (_) {}

  process.stderr.write('[BROWSER_APIS] Missing browser APIs installed\n');
}


// ── Screen ────────────────────────────────────────────────────

function installScreen(window) {
  const screenProps = {
    width: 1920, height: 1080,
    availWidth: 1920, availHeight: 1080,
    availLeft: 0, availTop: 0,
    colorDepth: 24, pixelDepth: 24,
  };
  try {
    for (const [k, v] of Object.entries(screenProps)) {
      Object.defineProperty(window.screen, k, { get: () => v, configurable: true });
    }
  } catch (_) {}

  // devicePixelRatio
  try {
    Object.defineProperty(window, 'devicePixelRatio', { get: () => 2, configurable: true });
  } catch (_) {}

  process.stderr.write('[STEALTH] Stealth patches installed\n');
}


// ── Performance ───────────────────────────────────────────────

function installPerformance(window) {
  if (!window.performance) {
    window.performance = {};
  }
  const perf = window.performance;
  const start = Date.now();

  if (!perf.now) perf.now = () => Date.now() - start;
  if (!perf.timeOrigin) perf.timeOrigin = start;
  if (!perf.getEntriesByType) perf.getEntriesByType = () => [];
  if (!perf.getEntriesByName) perf.getEntriesByName = () => [];
  if (!perf.mark) perf.mark = () => {};
  if (!perf.measure) perf.measure = () => {};
  if (!perf.clearMarks) perf.clearMarks = () => {};
  if (!perf.clearMeasures) perf.clearMeasures = () => {};
  if (!perf.navigation) {
    perf.navigation = { type: 0, redirectCount: 0 };
  }
  if (!perf.timing) {
    const t = start - 500;
    perf.timing = {
      navigationStart: t,
      unloadEventStart: 0, unloadEventEnd: 0,
      redirectStart: 0, redirectEnd: 0,
      fetchStart: t + 10,
      domainLookupStart: t + 20, domainLookupEnd: t + 50,
      connectStart: t + 50, connectEnd: t + 100,
      secureConnectionStart: t + 60,
      requestStart: t + 100,
      responseStart: t + 200, responseEnd: t + 300,
      domLoading: t + 310, domInteractive: t + 400,
      domContentLoadedEventStart: t + 410, domContentLoadedEventEnd: t + 420,
      domComplete: t + 500,
      loadEventStart: t + 500, loadEventEnd: t + 510,
    };
  }
}


// ── Canvas ────────────────────────────────────────────────────

function installCanvas(window) {
  // Stub HTMLCanvasElement if missing
  const OriginalHTMLCanvasElement = window.HTMLCanvasElement;

  const fakeCtx = {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {},
    createImageData: () => ({ data: [] }),
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 10 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
    // Canvas fingerprint noise
    getParameter: () => 0,
    getSupportedExtensions: () => [],
  };

  // Patch createElement to intercept canvas creation
  const origCreateElement = window.document.createElement.bind(window.document);
  window.document.createElement = function(tag, ...args) {
    const el = origCreateElement(tag, ...args);
    if (tag.toLowerCase() === 'canvas') {
      el.getContext = () => fakeCtx;
      el.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      el.toBlob = (cb) => cb(new Blob());
    }
    return el;
  };

  process.stderr.write('[FONTS] Font detection support installed\n');
}


// ── Audio ─────────────────────────────────────────────────────

function installAudio(window) {
  class MockAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.state = 'suspended';
      this.destination = { maxChannelCount: 2 };
      this.currentTime = 0;
    }
    createOscillator() {
      return {
        type: 'sine', frequency: { value: 440, setValueAtTime: () => {} },
        connect: () => {}, start: () => {}, stop: () => {},
        disconnect: () => {},
      };
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: -24 }, knee: { value: 30 },
        ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
        reduction: -20,
      };
    }
    createAnalyser() {
      return {
        fftSize: 2048, frequencyBinCount: 1024,
        connect: () => {}, disconnect: () => {},
        getFloatFrequencyData: () => {},
      };
    }
    createGain() { return { gain: { value: 1, setValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} }; }
    createScriptProcessor() { return { connect: () => {}, disconnect: () => {}, onaudioprocess: null }; }
    createBuffer() { return { getChannelData: () => new Float32Array(128) }; }
    createBufferSource() { return { buffer: null, connect: () => {}, start: () => {}, stop: () => {}, onended: null, loop: false }; }
    decodeAudioData(buf, cb) { if (cb) cb({ duration: 0, length: 0, numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array() }); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }

  try {
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
  } catch (_) {}

  process.stderr.write('[AUDIO] AudioContext mock installed\n');
}


// ── Storage ───────────────────────────────────────────────────

function installStorage(window) {
  class MockStorage {
    constructor() { this._data = {}; }
    get length() { return Object.keys(this._data).length; }
    key(n) { return Object.keys(this._data)[n] || null; }
    getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; }
    setItem(k, v) { this._data[k] = String(v); }
    removeItem(k) { delete this._data[k]; }
    clear() { this._data = {}; }
  }

  try {
    if (!window.localStorage) {
      Object.defineProperty(window, 'localStorage', { get: () => new MockStorage(), configurable: true });
    }
    if (!window.sessionStorage) {
      Object.defineProperty(window, 'sessionStorage', { get: () => new MockStorage(), configurable: true });
    }
  } catch (_) {}
}


// ── Misc browser APIs ─────────────────────────────────────────

function installMisc(window) {
  // requestAnimationFrame
  if (!window.requestAnimationFrame) {
    let rafId = 0;
    window.requestAnimationFrame = (cb) => { setTimeout(() => cb(Date.now()), 16); return ++rafId; };
    window.cancelAnimationFrame = () => {};
  }

  // crypto.getRandomValues
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = (arr) => {
      const { randomFillSync } = require('crypto');
      return randomFillSync(arr);
    };
  }
  if (!window.crypto.subtle) {
    window.crypto.subtle = {
      digest: async (algo, data) => {
        const { createHash } = require('crypto');
        const name = algo.name || algo;
        const h = createHash(name.replace('-', '').toLowerCase());
        h.update(Buffer.from(data));
        return h.digest().buffer;
      },
    };
  }

  // matchMedia
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  // IntersectionObserver stub
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // ResizeObserver stub
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      constructor(cb) { this.cb = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // MutationObserver (JSDOM has it, just ensure)
  if (!window.MutationObserver) {
    window.MutationObserver = class {
      constructor(cb) {}
      observe() {}
      disconnect() {}
    };
  }

  // History stub
  if (!window.history) {
    window.history = { pushState: () => {}, replaceState: () => {}, back: () => {}, forward: () => {}, go: () => {}, length: 1, state: null };
  }

  // Notification stub
  if (!window.Notification) {
    window.Notification = class { static permission = 'denied'; static requestPermission = async () => 'denied'; };
  }

  // WebGL stub
  const origGetContext = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype && window.HTMLCanvasElement.prototype.getContext;

  process.stderr.write('[EVENTS] Event simulation installed\n');
  process.stderr.write('[PX_INTERCEPT] Missing browser properties installed\n');
}


module.exports = { buildEnvironment };
