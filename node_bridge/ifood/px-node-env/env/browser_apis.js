/**
 * 补全 JSDOM 缺失的浏览器 API
 * 这些 API 被 PX SDK 检测，缺失会导致高 score
 */

function installBrowserAPIs(window) {
  const document = window.document;

  // Helper: make a function look native
  function makeNative(fn, name) {
    const nativeName = name || fn.name || '';
    Object.defineProperty(fn, 'toString', {
      value: () => `function ${nativeName}() { [native code] }`,
      writable: false,
      configurable: true
    });
    if (name) {
      Object.defineProperty(fn, 'name', {
        value: name,
        writable: false,
        configurable: true
      });
    }
    return fn;
  }

  // 1. matchMedia - CRITICAL: PX uses for CSS media queries
  if (!window.matchMedia) {
    window.matchMedia = makeNative(function matchMedia(query) {
      const mql = {
        matches: false,
        media: query,
        onchange: null,
        addListener: makeNative(function addListener() {}, 'addListener'),
        removeListener: makeNative(function removeListener() {}, 'removeListener'),
        addEventListener: makeNative(function addEventListener() {}, 'addEventListener'),
        removeEventListener: makeNative(function removeEventListener() {}, 'removeEventListener'),
        dispatchEvent: makeNative(function dispatchEvent() { return true; }, 'dispatchEvent'),
      };
      // Common queries PX checks
      if (query === '(pointer:coarse)') mql.matches = false;
      if (query === '(hover:none)') mql.matches = false;
      if (query.includes('color-gamut')) mql.matches = true;
      if (query.includes('prefers-color-scheme: dark')) mql.matches = false;
      return mql;
    }, 'matchMedia');
  }

  // 2. Worker - PX checks window.Worker existence
  if (!window.Worker) {
    window.Worker = makeNative(function Worker(url) {
      this.postMessage = makeNative(function postMessage() {}, 'postMessage');
      this.terminate = makeNative(function terminate() {}, 'terminate');
      this.onmessage = null;
      this.onerror = null;
      this.addEventListener = makeNative(function addEventListener() {}, 'addEventListener');
      this.removeEventListener = makeNative(function removeEventListener() {}, 'removeEventListener');
    }, 'Worker');
  }

  // 3. EventSource - PX checks hP(fo.EventSource)
  if (!window.EventSource) {
    window.EventSource = makeNative(function EventSource(url) {
      this.close = makeNative(function close() {}, 'close');
      this.onmessage = null;
      this.onerror = null;
      this.onopen = null;
      this.readyState = 0;
      this.url = url;
    }, 'EventSource');
  }

  // 4. FontFace - PX checks for ascentOverride
  if (!window.FontFace) {
    window.FontFace = makeNative(function FontFace(family, source) {
      this.family = family;
      this.ascentOverride = '';
      this.descentOverride = '';
      this.display = 'auto';
      this.featureSettings = 'normal';
      this.lineGapOverride = '';
      this.loaded = Promise.resolve(this);
      this.status = 'loaded';
      this.stretch = 'normal';
      this.style = 'normal';
      this.unicodeRange = 'U+0-10FFFF';
      this.variant = 'normal';
      this.variationSettings = 'normal';
      this.weight = 'normal';
      this.load = makeNative(function load() { return Promise.resolve(this); }, 'load');
    }, 'FontFace');
  }

  // 5. IntersectionObserver
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = makeNative(function IntersectionObserver(callback, options) {
      this.root = options?.root || null;
      this.rootMargin = options?.rootMargin || '0px';
      this.thresholds = options?.threshold ? [].concat(options.threshold) : [0];
      this.observe = makeNative(function observe() {}, 'observe');
      this.unobserve = makeNative(function unobserve() {}, 'unobserve');
      this.disconnect = makeNative(function disconnect() {}, 'disconnect');
      this.takeRecords = makeNative(function takeRecords() { return []; }, 'takeRecords');
    }, 'IntersectionObserver');
  }

  // 6. ResizeObserver
  if (!window.ResizeObserver) {
    window.ResizeObserver = makeNative(function ResizeObserver(callback) {
      this.observe = makeNative(function observe() {}, 'observe');
      this.unobserve = makeNative(function unobserve() {}, 'unobserve');
      this.disconnect = makeNative(function disconnect() {}, 'disconnect');
    }, 'ResizeObserver');
  }

  // 7. PerformanceObserver
  if (!window.PerformanceObserver) {
    window.PerformanceObserver = makeNative(function PerformanceObserver(callback) {
      this.observe = makeNative(function observe() {}, 'observe');
      this.disconnect = makeNative(function disconnect() {}, 'disconnect');
      this.takeRecords = makeNative(function takeRecords() { return []; }, 'takeRecords');
    }, 'PerformanceObserver');
    window.PerformanceObserver.supportedEntryTypes = ['element', 'event', 'first-input', 'largest-contentful-paint', 'layout-shift', 'longtask', 'mark', 'measure', 'navigation', 'paint', 'resource'];
  }

  // 8. performance.navigation - PX checks navigation.type
  if (window.performance && !window.performance.navigation) {
    window.performance.navigation = {
      type: 0,           // TYPE_NAVIGATE
      redirectCount: 0,
      TYPE_NAVIGATE: 0,
      TYPE_RELOAD: 1,
      TYPE_BACK_FORWARD: 2,
      TYPE_RESERVED: 255,
      toJSON: makeNative(function toJSON() {
        return { type: 0, redirectCount: 0 };
      }, 'toJSON'),
    };
  }

  // 9. performance.getEntries & getEntriesByName
  if (window.performance) {
    if (!window.performance.getEntries) {
      window.performance.getEntries = makeNative(function getEntries() { return []; }, 'getEntries');
    }
    if (!window.performance.getEntriesByName) {
      window.performance.getEntriesByName = makeNative(function getEntriesByName() { return []; }, 'getEntriesByName');
    }
    if (!window.performance.mark) {
      window.performance.mark = makeNative(function mark() {}, 'mark');
    }
    if (!window.performance.measure) {
      window.performance.measure = makeNative(function measure() {}, 'measure');
    }
    if (!window.performance.clearMarks) {
      window.performance.clearMarks = makeNative(function clearMarks() {}, 'clearMarks');
    }
    if (!window.performance.clearMeasures) {
      window.performance.clearMeasures = makeNative(function clearMeasures() {}, 'clearMeasures');
    }
  }

  // 10. URL.createObjectURL - needed for Worker/Blob
  if (window.URL && !window.URL.createObjectURL) {
    window.URL.createObjectURL = makeNative(function createObjectURL(blob) {
      return 'blob:https://www.ifood.com.br/' + crypto_randomUUID();
    }, 'createObjectURL');
    window.URL.revokeObjectURL = makeNative(function revokeObjectURL() {}, 'revokeObjectURL');
  }

  // 11. document.hidden / visibilityState
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true,
    });
  } catch (e) {}

  // 12. document.hasFocus
  if (!document.hasFocus || typeof document.hasFocus !== 'function') {
    document.hasFocus = makeNative(function hasFocus() { return true; }, 'hasFocus');
  }

  // 13. XDomainRequest should NOT exist (IE only)
  // Already undefined, good.

  // 14. openDatabase - should be undefined in modern Chrome (deprecated)
  // Already undefined, good.

  // 15. MediaSource - PX checks this
  if (!window.MediaSource) {
    window.MediaSource = makeNative(function MediaSource() {
      this.readyState = 'closed';
      this.duration = NaN;
      this.sourceBuffers = [];
      this.activeSourceBuffers = [];
      this.addEventListener = makeNative(function addEventListener() {}, 'addEventListener');
      this.removeEventListener = makeNative(function removeEventListener() {}, 'removeEventListener');
    }, 'MediaSource');
    window.MediaSource.isTypeSupported = makeNative(function isTypeSupported(mimeType) {
      return mimeType.includes('video/mp4') || mimeType.includes('video/webm');
    }, 'isTypeSupported');
  }

  // 16. Notification API
  if (!window.Notification) {
    window.Notification = makeNative(function Notification() {}, 'Notification');
    window.Notification.permission = 'default';
    window.Notification.requestPermission = makeNative(function requestPermission() {
      return Promise.resolve('default');
    }, 'requestPermission');
  }

  // 17. speechSynthesis - some detectors check this
  if (!window.speechSynthesis) {
    window.speechSynthesis = {
      getVoices: makeNative(function getVoices() { return []; }, 'getVoices'),
      speak: makeNative(function speak() {}, 'speak'),
      cancel: makeNative(function cancel() {}, 'cancel'),
      pause: makeNative(function pause() {}, 'pause'),
      resume: makeNative(function resume() {}, 'resume'),
      pending: false,
      speaking: false,
      paused: false,
      onvoiceschanged: null,
    };
  }

  console.log('[BROWSER_APIS] Missing browser APIs installed');
}

// Simple UUID generator
function crypto_randomUUID() {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) uuid += '-';
    else if (i === 14) uuid += '4';
    else if (i === 19) uuid += hex[(Math.random() * 4 | 0) + 8];
    else uuid += hex[Math.random() * 16 | 0];
  }
  return uuid;
}

module.exports = { installBrowserAPIs };
