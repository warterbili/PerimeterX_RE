/**
 * Phase 2.5 - 事件序列模拟
 * 模拟真实浏览器的用户交互事件
 */

/**
 * 安装事件模拟
 * @param {Window} window
 */
function installEventSimulation(window) {
  const document = window.document;

  // 1. 模拟页面加载事件序列
  simulatePageLoadEvents(window, document);

  // 2. 模拟鼠标移动事件（延迟触发，模拟真实用户）
  simulateMouseMovements(window, document);

  // 3. 模拟滚动事件
  simulateScrollEvents(window, document);

  // 4. 补全 document.readyState 变化
  patchReadyState(document);

  // 5. 补全 document.visibilityState
  patchVisibility(document);

  console.log('[EVENTS] Event simulation installed');
}

/**
 * 模拟页面加载事件序列
 */
function simulatePageLoadEvents(window, document) {
  const timeOrigin = window.performance.timeOrigin || Date.now() - 500;

  // 确保 readyState 先是 interactive，然后变为 complete
  let _readyState = 'complete';
  Object.defineProperty(document, 'readyState', {
    get: () => _readyState,
    configurable: true,
  });

  // DOMContentLoaded 已经发生（我们假设页面已加载）
  // 记录到 performance entries
  if (window.performance.getEntriesByType) {
    const origGetEntries = window.performance.getEntriesByType;
    window.performance.getEntriesByType = function(type) {
      if (type === 'navigation') {
        return [{
          name: window.location.href,
          entryType: 'navigation',
          startTime: 0,
          duration: 450 + Math.random() * 100,
          initiatorType: 'navigation',
          type: 'navigate',
          redirectCount: 0,
          domContentLoadedEventStart: 280 + Math.random() * 20,
          domContentLoadedEventEnd: 290 + Math.random() * 20,
          domComplete: 440 + Math.random() * 20,
          loadEventStart: 445 + Math.random() * 20,
          loadEventEnd: 450 + Math.random() * 20,
          domInteractive: 275 + Math.random() * 20,
          fetchStart: 2 + Math.random() * 5,
          connectStart: 10 + Math.random() * 5,
          connectEnd: 50 + Math.random() * 10,
          requestStart: 55 + Math.random() * 10,
          responseStart: 100 + Math.random() * 20,
          responseEnd: 150 + Math.random() * 20,
          transferSize: 45000 + Math.floor(Math.random() * 5000),
          encodedBodySize: 42000 + Math.floor(Math.random() * 5000),
          decodedBodySize: 180000 + Math.floor(Math.random() * 20000),
          unloadEventStart: 0,
          unloadEventEnd: 0,
          domainLookupStart: 2 + Math.random() * 2,
          domainLookupEnd: 8 + Math.random() * 3,
          secureConnectionStart: 15 + Math.random() * 5,
          nextHopProtocol: 'h2',
          serverTiming: [],
          workerStart: 0,
        }];
      }
      if (type === 'resource') {
        // 返回一些常见资源
        return [
          { name: 'https://www.ifood.com.br/_next/static/chunks/main.js', entryType: 'resource', startTime: 100, duration: 80, initiatorType: 'script' },
          { name: 'https://www.ifood.com.br/_next/static/chunks/framework.js', entryType: 'resource', startTime: 110, duration: 90, initiatorType: 'script' },
          { name: 'https://www.ifood.com.br/_next/static/css/style.css', entryType: 'resource', startTime: 105, duration: 40, initiatorType: 'link' },
        ];
      }
      if (type === 'paint') {
        return [
          { name: 'first-paint', entryType: 'paint', startTime: 200 + Math.random() * 50, duration: 0 },
          { name: 'first-contentful-paint', entryType: 'paint', startTime: 220 + Math.random() * 50, duration: 0 },
        ];
      }
      return origGetEntries.call(this, type);
    };
  }
}

/**
 * 模拟鼠标移动事件
 */
function simulateMouseMovements(window, document) {
  const moves = [];
  let lastX = 400 + Math.floor(Math.random() * 200);
  let lastY = 300 + Math.floor(Math.random() * 100);

  // 生成 5-8 次鼠标移动轨迹
  const numMoves = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numMoves; i++) {
    // 模拟人类鼠标移动 - 不是完全随机，而是有方向性
    lastX += Math.floor((Math.random() - 0.3) * 80);
    lastY += Math.floor((Math.random() - 0.3) * 60);
    // 保持在合理范围内
    lastX = Math.max(50, Math.min(1870, lastX));
    lastY = Math.max(50, Math.min(1030, lastY));
    moves.push({ x: lastX, y: lastY, delay: 100 + Math.floor(Math.random() * 300) });
  }

  // 延迟触发鼠标事件（模拟用户在页面加载后开始移动鼠标）
  let totalDelay = 500 + Math.floor(Math.random() * 500);
  moves.forEach((move) => {
    totalDelay += move.delay;
    setTimeout(() => {
      try {
        const event = new window.MouseEvent('mousemove', {
          clientX: move.x,
          clientY: move.y,
          pageX: move.x,
          pageY: move.y,
          screenX: move.x,
          screenY: move.y + 85,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        // PX listens on document.body, dispatch there; bubbles up to document
        (document.body || document).dispatchEvent(event);
      } catch (e) {
        // ignore
      }
    }, totalDelay);
  });

  // 模拟一次点击（在鼠标移动之后）
  totalDelay += 300 + Math.floor(Math.random() * 500);
  setTimeout(() => {
    try {
      const clickEvent = new window.MouseEvent('click', {
        clientX: lastX,
        clientY: lastY,
        pageX: lastX,
        pageY: lastY,
        screenX: lastX,
        screenY: lastY + 85,
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
      });
      (document.body || document).dispatchEvent(clickEvent);
    } catch (e) {
      // ignore
    }
  }, totalDelay);
}

/**
 * 模拟滚动事件
 */
function simulateScrollEvents(window, document) {
  let scrollY = 0;
  const scrolls = [
    { delta: 150 + Math.floor(Math.random() * 100), delay: 2000 + Math.floor(Math.random() * 1000) },
    { delta: 200 + Math.floor(Math.random() * 150), delay: 800 + Math.floor(Math.random() * 500) },
    { delta: 100 + Math.floor(Math.random() * 80), delay: 600 + Math.floor(Math.random() * 400) },
  ];

  let totalDelay = 1500 + Math.floor(Math.random() * 1000);
  scrolls.forEach((scroll) => {
    totalDelay += scroll.delay;
    setTimeout(() => {
      scrollY += scroll.delta;
      try {
        // 更新 scrollY
        Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true });
        Object.defineProperty(window, 'pageYOffset', { get: () => scrollY, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollTop', { get: () => scrollY, configurable: true });

        const scrollEvent = new window.Event('scroll', { bubbles: true });
        window.dispatchEvent(scrollEvent);
        document.dispatchEvent(scrollEvent);
      } catch (e) {
        // ignore
      }
    }, totalDelay);
  });
}

/**
 * 补全 readyState
 */
function patchReadyState(document) {
  // readyState 已在上面设置为 complete
  // 确保 document 有正确的 contentType
  try {
    Object.defineProperty(document, 'contentType', {
      get: () => 'text/html',
      configurable: true,
    });
  } catch (e) {}
}

/**
 * 补全 visibilityState
 */
function patchVisibility(document) {
  try {
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true,
    });
  } catch (e) {}
}

module.exports = { installEventSimulation };
