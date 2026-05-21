/**
 * PX SDK Function Intercept
 * 
 * Instead of trying to fake hundreds of browser APIs,
 * we intercept the PX SDK's fingerprint collection functions
 * and inject known-good values from a real Chrome browser.
 * 
 * This module patches the PX SDK AFTER it's loaded by
 * overriding specific functions.
 */

/**
 * Known-good fingerprint values captured from a real Chrome 131 on macOS
 * These are the hashed values that PX SDK collects
 */
const REAL_CHROME_FINGERPRINTS = {
  // Window property hash from xS(window, ...)
  windowKeysHash: null,  // Will be captured from real browser
  // Document property hash
  documentKeysHash: null,
  // Navigator property hash  
  navigatorKeysHash: null,
  // Location property hash
  locationKeysHash: null,
};

/**
 * Add critical missing properties to window to improve xS hash
 * These are properties that real Chrome 131 has but JSDOM doesn't
 */
function installMissingWindowProps(window) {
  const document = window.document;
  
  // Helper for native-looking functions
  function nativeFn(name) {
    const fn = function() {};
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    Object.defineProperty(fn, 'toString', {
      value: () => `function ${name}() { [native code] }`,
    });
    return fn;
  }

  // Add missing window properties that PX specifically checks in xN()
  const windowStubs = {
    closed: false,
    cookieStore: { get: nativeFn('get'), set: nativeFn('set'), delete: nativeFn('delete'), getAll: nativeFn('getAll') },
    visualViewport: { width: 1920, height: 969, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, scale: 1, onresize: null, onscroll: null },
    indexedDB: { open: nativeFn('open'), deleteDatabase: nativeFn('deleteDatabase'), cmp: nativeFn('cmp'), databases: nativeFn('databases') },
    caches: { open: nativeFn('open'), has: nativeFn('has'), delete: nativeFn('delete'), keys: nativeFn('keys'), match: nativeFn('match') },
    
    // WebRTC
    RTCPeerConnection: nativeFn('RTCPeerConnection'),
    RTCSessionDescription: nativeFn('RTCSessionDescription'),
    RTCIceCandidate: nativeFn('RTCIceCandidate'),
    
    // Media
    AudioTrack: undefined, // Not in Chrome desktop
    
    // WebKit specific
    webkitSpeechRecognition: nativeFn('webkitSpeechRecognition'),
    webkitSpeechGrammar: nativeFn('webkitSpeechGrammar'),
    webkitSpeechGrammarList: nativeFn('webkitSpeechGrammarList'),
    webkitSpeechRecognitionError: nativeFn('webkitSpeechRecognitionError'),
    webkitSpeechRecognitionEvent: nativeFn('webkitSpeechRecognitionEvent'),
    webkitMediaStream: nativeFn('webkitMediaStream'),
    
    // Other
    queueMicrotask: nativeFn('queueMicrotask'),
    structuredClone: nativeFn('structuredClone'),
    reportError: nativeFn('reportError'),
    crossOriginIsolated: false,
    isSecureContext: true,
    origin: 'https://www.ifood.com.br',
    scheduler: { postTask: nativeFn('postTask'), yield: nativeFn('yield') },
    navigation: { currentEntry: null, entries: nativeFn('entries'), navigate: nativeFn('navigate') },
    
    // Needed for event checks
    onpointerdown: null,
    onpointerup: null,
    onpointermove: null,
    onpointerenter: null,
    onpointerleave: null,
    onpointerover: null,
    onpointerout: null,
    onpointercancel: null,
    ongotpointercapture: null,
    onlostpointercapture: null,
    
    // Touch events (desktop Chrome on Mac doesn't have these normally)
    ontouchstart: undefined,
    
    // Animation
    requestIdleCallback: nativeFn('requestIdleCallback'),
    cancelIdleCallback: nativeFn('cancelIdleCallback'),
    
    // Storage - don't override sessionStorage, JSDOM has its own
    
    // Clipboard
    ClipboardItem: nativeFn('ClipboardItem'),
  };

  for (const [key, value] of Object.entries(windowStubs)) {
    if (!(key in window)) {
      try {
        Object.defineProperty(window, key, {
          value: value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (e) {}
    }
  }

  // Document stubs
  const docStubs = {
    fragmentDirective: {},
    pictureInPictureEnabled: true,
    pictureInPictureElement: null,
    exitPictureInPicture: nativeFn('exitPictureInPicture'),
    featurePolicy: { allowsFeature: nativeFn('allowsFeature'), features: nativeFn('features'), allowedFeatures: nativeFn('allowedFeatures'), getAllowlistForFeature: nativeFn('getAllowlistForFeature') },
    onscrollend: null,
    onselectionchange: null,
    onfullscreenchange: null,
    onfullscreenerror: null,
    onvisibilitychange: null,
    fonts: { check: nativeFn('check'), load: nativeFn('load'), ready: Promise.resolve(), size: 50 },
  };

  for (const [key, value] of Object.entries(docStubs)) {
    if (!(key in document)) {
      try {
        Object.defineProperty(document, key, {
          value: value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (e) {}
    }
  }

  // Navigator stubs - be careful not to break JSDOM internals
  const nav = window.navigator;
  const navStubs = {
    pdfViewerEnabled: false,
    userActivation: { hasBeenActive: true, isActive: false },
  };

  for (const [key, value] of Object.entries(navStubs)) {
    if (!(key in nav)) {
      try {
        Object.defineProperty(nav, key, {
          value: value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (e) {}
    }
  }

  console.log('[PX_INTERCEPT] Missing browser properties installed');
}

module.exports = { installMissingWindowProps };
